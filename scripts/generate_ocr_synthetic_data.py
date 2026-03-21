import argparse
import json
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAVE_ARABIC_SHAPER = True
except Exception:
    HAVE_ARABIC_SHAPER = False


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def shape_text(text: str) -> str:
    if not HAVE_ARABIC_SHAPER or not any('\u0600' <= char <= '\u06FF' for char in text):
        return text
    return get_display(arabic_reshaper.reshape(text))


def find_fonts():
    fonts_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    candidates = [
        'arial.ttf',
        'arialbd.ttf',
        'segoeui.ttf',
        'tahoma.ttf',
        'times.ttf',
        'verdana.ttf',
    ]
    return [fonts_dir / name for name in candidates if (fonts_dir / name).exists()]


def choose_font(fonts, size):
    for font_path in random.sample(fonts, k=len(fonts)):
        try:
            return ImageFont.truetype(str(font_path), size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def build_samples(domain, count):
    latin_first = [item for item in domain['firstNames'] if not any('\u0600' <= char <= '\u06FF' for char in item)]
    latin_family = [item for item in domain['familyNames'] if not any('\u0600' <= char <= '\u06FF' for char in item)]
    arabic_first = [item for item in domain['firstNames'] if any('\u0600' <= char <= '\u06FF' for char in item)]
    arabic_family = [item for item in domain['familyNames'] if any('\u0600' <= char <= '\u06FF' for char in item)]
    beds = domain['beds']
    diagnoses = domain['medicalTerms']
    meds = domain['medications']

    for index in range(count):
        age = 18 + (index % 75)
        gender = 'M' if index % 2 == 0 else 'F'
        sample_type = random.choice(['row_latin', 'row_latin_med', 'name_arabic', 'token_dx', 'token_med'])

        if sample_type == 'row_latin':
            text = f"{beds[index % len(beds)]} {latin_first[index % len(latin_first)]} {latin_family[index % len(latin_family)]} {age}/{gender} {diagnoses[index % len(diagnoses)]}"
            language = 'latin'
        elif sample_type == 'row_latin_med':
            text = f"{beds[(index + 7) % len(beds)]} {latin_first[(index + 11) % len(latin_first)]} {latin_family[(index + 19) % len(latin_family)]} {age}/{gender} {diagnoses[(index + 13) % len(diagnoses)]} {meds[(index + 17) % len(meds)]}"
            language = 'mixed'
        elif sample_type == 'name_arabic':
            text = f"{arabic_first[index % len(arabic_first)]} {arabic_family[index % len(arabic_family)]}"
            language = 'arabic'
        elif sample_type == 'token_dx':
            text = diagnoses[index % len(diagnoses)]
            language = 'latin'
        else:
            text = meds[index % len(meds)]
            language = 'latin'

        yield {
            'text': text,
            'language': language,
            'split': 'train' if index < count * 0.9 else ('val' if index < count * 0.97 else 'test'),
        }


def render_sample(text, fonts):
    rendered_text = shape_text(text)
    font_size = random.randint(24, 42)
    font = choose_font(fonts, font_size)

    canvas = Image.new('L', (1400, 120), color=random.randint(245, 255))
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), rendered_text, font=font)
    width = max(160, bbox[2] - bbox[0] + 32)
    height = max(64, bbox[3] - bbox[1] + 28)

    canvas = Image.new('L', (width, height), color=random.randint(240, 255))
    draw = ImageDraw.Draw(canvas)
    x = 16
    y = max(8, (height - (bbox[3] - bbox[1])) // 2 - bbox[1])
    draw.text((x, y), rendered_text, font=font, fill=random.randint(0, 36))

    if random.random() < 0.45:
        canvas = canvas.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.0, 1.3)))

    if random.random() < 0.65:
        angle = random.uniform(-3.5, 3.5)
        canvas = canvas.rotate(angle, expand=True, fillcolor=255)

    return canvas


def main():
    parser = argparse.ArgumentParser(description='Generate synthetic OCR crops for MedTriage OCR training.')
    parser.add_argument('--lexicon', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--count', type=int, default=1500)
    args = parser.parse_args()

    domain = load_json(Path(args.lexicon))
    output_root = Path(args.output)
    images_dir = output_root / 'images'
    ensure_dir(images_dir)

    fonts = find_fonts()
    if not fonts:
        raise RuntimeError('No suitable Windows fonts found for synthetic OCR generation.')

    labels_path = output_root / 'labels.jsonl'
    rows = []

    for index, sample in enumerate(build_samples(domain, args.count)):
        image = render_sample(sample['text'], fonts)
        image_name = f"sample_{index:05d}.png"
        image_path = images_dir / image_name
        image.save(image_path)

        rows.append(json.dumps({
            'image': f"images/{image_name}",
            'text': sample['text'],
            'language': sample['language'],
            'split': sample['split'],
            'source': 'synthetic-medtriage',
        }, ensure_ascii=False))

    with labels_path.open('w', encoding='utf-8') as handle:
        handle.write('\n'.join(rows) + '\n')

    print('Generated synthetic OCR dataset')
    print(f'  Images: {len(rows)}')
    print(f'  Output: {output_root}')


if __name__ == '__main__':
    main()
