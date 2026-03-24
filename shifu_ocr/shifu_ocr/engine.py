"""
Shifu-OCR: Fluid Theory OCR Engine
Core module — the landscape classifier with full pipeline.
"""

import numpy as np
import json
import os
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from skimage import morphology, filters, measure
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')


# =============================================================================
# MEDIUM DISPLACEMENT PIPELINE
# =============================================================================

def estimate_background(img, k=25):
    return filters.gaussian(morphology.closing(img, morphology.disk(k)), sigma=k/2)

def compute_displacement(img, bg):
    d = bg.astype(float) - img.astype(float)
    r = d.max() - d.min()
    return (d - d.min()) / r if r > 0 else d * 0

def detect_perturbation(disp, thresh=0.25):
    return morphology.remove_small_objects(disp > thresh, min_size=8).astype(np.uint8)

def extract_region(binary, pad=3):
    coords = np.argwhere(binary > 0)
    if len(coords) == 0:
        return binary
    r0, c0 = np.maximum(coords.min(axis=0) - pad, 0)
    r1, c1 = np.minimum(coords.max(axis=0) + pad, np.array(binary.shape) - 1)
    return binary[r0:r1+1, c0:c1+1]

def normalize_region(region, size=(64, 64)):
    img = Image.fromarray((region * 255).astype(np.uint8)).resize(size, Image.NEAREST)
    return (np.array(img) > 127).astype(np.uint8)

def image_to_binary(char_img, bg_kernel=15, disp_thresh=0.25):
    bg = estimate_background(char_img, k=bg_kernel)
    disp = compute_displacement(char_img, bg)
    return detect_perturbation(disp, thresh=disp_thresh), disp


# =============================================================================
# FEATURE EXTRACTION
# =============================================================================

FEATURE_NAMES = (
    ['components', 'holes', 'euler', 'displacement_ratio',
     'v_symmetry', 'h_symmetry', 'v_center', 'h_center'] +
    [f'quad_{q}' for q in ['TL', 'TR', 'BL', 'BR']] +
    [f'hproj_{i}' for i in range(6)] +
    [f'vproj_{i}' for i in range(6)] +
    [f'hcross_{i}' for i in range(6)] +
    [f'vcross_{i}' for i in range(6)] +
    ['endpoints', 'junctions']
)

def extract_features(br):
    h, w = br.shape
    feats = []

    # Topology
    padded = np.pad(br, 1, mode='constant', constant_values=0)
    _, nfg = ndimage.label(padded)
    _, nbg = ndimage.label(1 - padded)
    holes = nbg - 1
    feats.extend([float(nfg), float(holes), float(nfg - holes)])

    # Displacement ratio
    feats.append(float(np.mean(br)))

    # Symmetry
    feats.append(float(np.mean(br == np.fliplr(br))) if w >= 2 else 1.0)
    feats.append(float(np.mean(br == np.flipud(br))) if h >= 2 else 1.0)

    # Center of mass
    total = br.sum()
    if total > 0 and h > 0 and w > 0:
        rows, cols = np.arange(h).reshape(-1, 1), np.arange(w).reshape(1, -1)
        feats.append(float((br * rows).sum() / (total * h)))
        feats.append(float((br * cols).sum() / (total * w)))
    else:
        feats.extend([0.5, 0.5])

    # Quadrant density
    mh, mw = h // 2, w // 2
    quads = [
        float(br[:mh, :mw].mean()) if mh > 0 and mw > 0 else 0,
        float(br[:mh, mw:].mean()) if mh > 0 else 0,
        float(br[mh:, :mw].mean()) if mw > 0 else 0,
        float(br[mh:, mw:].mean()),
    ]
    qt = sum(quads)
    feats.extend([q / qt if qt > 0 else 0.25 for q in quads])

    # Projection profiles
    for axis, length in [(1, h), (0, w)]:
        raw = br.mean(axis=axis)
        bins = 6
        proj = np.zeros(bins)
        bw = max(1, len(raw) // bins)
        for i in range(bins):
            s, e = i * bw, min((i + 1) * bw, len(raw))
            if s < len(raw):
                proj[i] = raw[s:e].mean()
        pt = proj.sum()
        if pt > 0:
            proj /= pt
        feats.extend(proj.tolist())

    # Crossing counts
    for axis in [0, 1]:
        for i in range(6):
            if axis == 0:
                row = min(int((i + 0.5) * h / 6), h - 1)
                line = br[row, :]
            else:
                col = min(int((i + 0.5) * w / 6), w - 1)
                line = br[:, col]
            feats.append(float(np.abs(np.diff(line.astype(int))).sum() / 2))

    # Junctions and endpoints
    if h >= 4 and w >= 4 and br.sum() >= 10:
        try:
            skel = morphology.skeletonize(br.astype(bool))
            nc = ndimage.convolve(skel.astype(int), np.ones((3, 3), dtype=int),
                                   mode='constant') - skel.astype(int)
            _, n_ep = ndimage.label(skel & (nc == 1))
            _, n_jp = ndimage.label(skel & (nc >= 3))
            feats.extend([float(n_ep), float(n_jp)])
        except:
            feats.extend([0.0, 0.0])
    else:
        feats.extend([0.0, 0.0])

    return np.array(feats, dtype=float)


# =============================================================================
# FLUID LANDSCAPE
# =============================================================================

class Landscape:
    def __init__(self, label):
        self.label = label
        self.observations = []
        self.mean = None
        self.variance = None
        self.n = 0
        self.n_correct = 0
        self.n_errors = 0
        self.confused_with = defaultdict(int)

    def absorb(self, fv):
        self.observations.append(fv.copy())
        self.n = len(self.observations)
        if self.n == 1:
            self.mean = fv.copy()
            self.variance = np.ones_like(fv) * 2.0
        else:
            obs = np.array(self.observations)
            self.mean = obs.mean(axis=0)
            raw_var = obs.var(axis=0) if self.n >= 2 else np.ones_like(fv)
            self.variance = np.maximum(raw_var, 0.1 / np.sqrt(self.n))

    def fit(self, fv):
        if self.mean is None:
            return -float('inf')
        diff = fv - self.mean
        precision = 1.0 / (self.variance + 1e-8)
        score = -0.5 * np.sum(diff ** 2 * precision)
        return score + np.log(self.n + 1) * 0.5

    def to_dict(self):
        return {
            'label': self.label,
            'n': self.n,
            'mean': self.mean.tolist() if self.mean is not None else None,
            'variance': self.variance.tolist() if self.variance is not None else None,
            'n_correct': self.n_correct,
            'n_errors': self.n_errors,
            'confused_with': dict(self.confused_with),
        }

    @classmethod
    def from_dict(cls, d):
        l = cls(d['label'])
        l.n = d['n']
        l.mean = np.array(d['mean']) if d['mean'] else None
        l.variance = np.array(d['variance']) if d['variance'] else None
        l.n_correct = d.get('n_correct', 0)
        l.n_errors = d.get('n_errors', 0)
        l.confused_with = defaultdict(int, d.get('confused_with', {}))
        return l


# =============================================================================
# SHIFU-OCR ENGINE
# =============================================================================

class ShifuOCR:
    """
    Complete Fluid Theory OCR engine.
    
    Train on character images → builds landscapes.
    Predict on new images → finds best-fit landscape.
    Learn from corrections → reshapes landscapes.
    Save/load → persist the trained model.
    """

    def __init__(self):
        self.landscapes = {}
        self.total_predictions = 0
        self.total_correct = 0
        self.version = "1.0.0"

    # --- Training ---

    def train_character(self, label, grayscale_image):
        """Train on a single character image (grayscale numpy array)."""
        binary, _ = image_to_binary(grayscale_image)
        region = normalize_region(extract_region(binary))
        fv = extract_features(region)
        if label not in self.landscapes:
            self.landscapes[label] = Landscape(label)
        self.landscapes[label].absorb(fv)

    def train_from_fonts(self, characters, font_paths, font_size=80, img_size=(100, 100)):
        """Train on rendered characters across multiple fonts."""
        for char in characters:
            for font_path in font_paths:
                img = self._render(char, font_path, font_size, img_size)
                self.train_character(char, img)
        return len(characters) * len(font_paths)

    # --- Prediction ---

    def predict_character(self, grayscale_image, top_k=5):
        """Predict a single character from a grayscale image."""
        binary, disp = image_to_binary(grayscale_image)
        region = normalize_region(extract_region(binary))
        fv = extract_features(region)

        scores = [(label, land.fit(fv)) for label, land in self.landscapes.items()]
        scores.sort(key=lambda x: x[1], reverse=True)

        if len(scores) < 2:
            return {'predicted': scores[0][0] if scores else '?', 'confidence': 0, 'candidates': scores}

        best_score = scores[0][1]
        second_score = scores[1][1]
        margin = best_score - second_score
        total_range = scores[0][1] - scores[-1][1]
        confidence = max(0, min(margin / max(abs(total_range), 0.01), 1.0))

        self.total_predictions += 1

        return {
            'predicted': scores[0][0],
            'confidence': confidence,
            'margin': margin,
            'candidates': scores[:top_k],
            'features': fv,
            'binary_region': region,
        }

    def correct(self, prediction, true_label):
        """Learn from a correction."""
        fv = prediction['features']
        predicted = prediction['predicted']
        correct = predicted == true_label

        if correct:
            self.total_correct += 1
            if true_label in self.landscapes:
                self.landscapes[true_label].n_correct += 1
        else:
            if predicted in self.landscapes:
                self.landscapes[predicted].n_errors += 1
                self.landscapes[predicted].confused_with[true_label] += 1

        if true_label in self.landscapes:
            self.landscapes[true_label].absorb(fv)

        return correct

    # --- Text Processing ---

    def segment_characters(self, grayscale_image, min_char_width=3):
        """
        Segment a text line image into individual character images.
        Uses simple Otsu binarization (better for full lines) + vertical projection.
        """
        from skimage.filters import threshold_otsu
        
        # For line images, simple Otsu works better than medium displacement
        # because characters are close together and the background is uniform
        try:
            thresh = threshold_otsu(grayscale_image)
        except:
            thresh = 128
        
        binary = (grayscale_image < thresh).astype(np.uint8)
        
        # Clean up
        binary = morphology.remove_small_objects(binary.astype(bool), min_size=5).astype(np.uint8)
        
        # Vertical projection — sum ink in each column
        v_proj = binary.sum(axis=0).astype(float)
        
        # Find character boundaries by detecting gaps
        is_ink = v_proj > 0
        segments = []
        in_char = False
        start = 0
        
        for i in range(len(is_ink)):
            if is_ink[i] and not in_char:
                start = i
                in_char = True
            elif not is_ink[i] and in_char:
                if i - start >= min_char_width:
                    segments.append((start, i))
                in_char = False
        
        if in_char and len(is_ink) - start >= min_char_width:
            segments.append((start, len(is_ink)))
        
        # Extract character images — pad each into a square for consistent processing
        char_images = []
        for c_start, c_end in segments:
            col_slice = binary[:, c_start:c_end]
            row_proj = col_slice.sum(axis=1)
            rows_with_ink = np.where(row_proj > 0)[0]
            
            if len(rows_with_ink) == 0:
                continue
            
            r_start = max(0, rows_with_ink[0] - 2)
            r_end = min(binary.shape[0], rows_with_ink[-1] + 3)
            
            # Extract from ORIGINAL grayscale (not binary)
            char_crop = grayscale_image[r_start:r_end, c_start:c_end]
            
            # Pad into a square with white background for consistent processing
            ch, cw = char_crop.shape
            size = max(ch, cw) + 10
            padded = np.full((size, size), 255, dtype=np.uint8)
            y_off = (size - ch) // 2
            x_off = (size - cw) // 2
            padded[y_off:y_off+ch, x_off:x_off+cw] = char_crop
            
            char_images.append({
                'image': padded,
                'bbox': (r_start, c_start, r_end, c_end),
            })
        
        return char_images

    def read_line(self, grayscale_image, space_threshold=None):
        """
        Read a line of text from a grayscale image.
        Returns recognized text with per-character confidence.
        """
        char_segments = self.segment_characters(grayscale_image)
        
        if not char_segments:
            return {'text': '', 'characters': [], 'confidence': 0}
        
        # Detect spaces by looking at gaps between segments
        if space_threshold is None:
            gaps = []
            for i in range(1, len(char_segments)):
                prev_end = char_segments[i-1]['bbox'][3]
                curr_start = char_segments[i]['bbox'][1]
                gaps.append(curr_start - prev_end)
            
            if gaps:
                median_gap = np.median(gaps)
                space_threshold = median_gap * 2.0
            else:
                space_threshold = 20
        
        results = []
        text_parts = []
        
        for i, seg in enumerate(char_segments):
            pred = self.predict_character(seg['image'])
            results.append({
                'char': pred['predicted'],
                'confidence': pred['confidence'],
                'bbox': seg['bbox'],
                'candidates': pred['candidates'][:3],
            })
            
            # Check for space before this character
            if i > 0:
                prev_end = char_segments[i-1]['bbox'][3]
                curr_start = seg['bbox'][1]
                if curr_start - prev_end > space_threshold:
                    text_parts.append(' ')
            
            text_parts.append(pred['predicted'])
        
        text = ''.join(text_parts)
        avg_conf = np.mean([r['confidence'] for r in results]) if results else 0
        
        return {
            'text': text,
            'characters': results,
            'confidence': avg_conf,
        }

    # --- Rendering utility ---

    def _render(self, char, font_path, font_size=80, img_size=(100, 100)):
        img = Image.new('L', img_size, color=255)
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), char, font=font)
        x = (img_size[0] - (bbox[2] - bbox[0])) // 2 - bbox[0]
        y = (img_size[1] - (bbox[3] - bbox[1])) // 2 - bbox[1]
        draw.text((x, y), char, fill=0, font=font)
        return np.array(img)

    @staticmethod
    def render_text_line(text, font_path, font_size=40, padding=10):
        """Render a line of text as a grayscale image."""
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            font = ImageFont.load_default()
        
        # Measure text
        dummy = Image.new('L', (1, 1))
        draw = ImageDraw.Draw(dummy)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        
        img = Image.new('L', (tw + padding * 2, th + padding * 2), color=255)
        draw = ImageDraw.Draw(img)
        draw.text((padding - bbox[0], padding - bbox[1]), text, fill=0, font=font)
        return np.array(img)

    # --- Save / Load ---

    def save(self, path):
        """Save trained model to JSON."""
        data = {
            'version': self.version,
            'total_predictions': self.total_predictions,
            'total_correct': self.total_correct,
            'landscapes': {k: v.to_dict() for k, v in self.landscapes.items()},
        }
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, path):
        """Load trained model from JSON."""
        with open(path) as f:
            data = json.load(f)
        engine = cls()
        engine.version = data.get('version', '1.0.0')
        engine.total_predictions = data.get('total_predictions', 0)
        engine.total_correct = data.get('total_correct', 0)
        for label, ld in data.get('landscapes', {}).items():
            engine.landscapes[label] = Landscape.from_dict(ld)
        return engine

    # --- Stats ---

    def get_stats(self):
        n_chars = len(self.landscapes)
        depths = [l.n for l in self.landscapes.values()]
        acc = self.total_correct / self.total_predictions * 100 if self.total_predictions > 0 else 0
        return {
            'characters': n_chars,
            'min_depth': min(depths) if depths else 0,
            'max_depth': max(depths) if depths else 0,
            'avg_depth': np.mean(depths) if depths else 0,
            'total_predictions': self.total_predictions,
            'total_correct': self.total_correct,
            'accuracy': acc,
        }
