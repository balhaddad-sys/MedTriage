# iOS NFC Setup (after running `npx cap add ios`)

## 1. Add NFC capability in Xcode
- Open `ios/App/App.xcworkspace` in Xcode
- Select the App target > Signing & Capabilities
- Click "+ Capability" > "Near Field Communication Tag Reading"

## 2. Add to Info.plist
Add this to `ios/App/App/Info.plist`:

```xml
<key>NFCReaderUsageDescription</key>
<string>MedTriage needs NFC to read Kuwait Civil ID cards for patient registration</string>
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
  <string>D2760000850101</string>
</array>
```

## 3. Add entitlements
In `ios/App/App/App.entitlements`:

```xml
<key>com.apple.developer.nfc.readersession.formats</key>
<array>
  <string>NDEF</string>
  <string>TAG</string>
</array>
```

## 4. Build
```bash
npm run build:ios
npx cap open ios
# Then build in Xcode (Cmd+R)
```
