# RescueNet – Hurricane Victim Form

Mobile-responsive React Native (Expo) form for hurricane victims. Styled with **NativeWind** (Tailwind for React Native) for high visibility and accessibility.

## Features

- **Name** – Full name text input
- **Parish** – Select: Westmoreland, St. James, St. Elizabeth
- **Needs description** – Multiline text for detailed needs
- **Image upload** – Optional photo attachment (placeholder + expo-image-picker)
- High-contrast colors, large touch targets, and clear labels

## Run the app

```bash
npm install
npx expo start
```

Then scan the QR code with Expo Go (Android/iOS) or press `a` / `i` for emulator.

### If npm install or npx expo start fails (Windows)

- **TAR_ENTRY_ERROR, EPERM, ENOTEMPTY, or "expo is not installed"**: Do a clean install:
  1. Close Cursor (and any other apps using this folder).
  2. In PowerShell, from the project root run:
     ```powershell
     npm run clean-install
     ```
  3. If you get EPERM when deleting `node_modules`, run PowerShell **as Administrator** and run `npm run clean-install` again.
- **"Cannot determine Expo SDK version"**: Usually means `node_modules` is missing or broken; run `npm run clean-install` then `npx expo start`.
- **Corrupted tarball / chalk warnings**: The project `.npmrc` uses `prefer-online=true`. Clear cache and reinstall: `npm cache clean --force` then `npm run clean-install`.

## Project structure

- `App.tsx` – Entry, SafeAreaView, status bar
- `components/HurricaneVictimForm.tsx` – Form UI and logic
- `global.css` – Tailwind directives
- `tailwind.config.js` – Theme (rescue colors, etc.)

## Tech stack

- Expo SDK 52
- React Native
- NativeWind (Tailwind CSS)
- @react-native-picker/picker (Parish select)
- expo-image-picker (photo placeholder)
