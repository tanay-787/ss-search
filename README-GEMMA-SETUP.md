Gemma 4 E2B (IT) Setup Notes

1. Expo app.json already includes the plugin `react-native-litert-lm` and minSdkVersion 26.
2. iOS entitlement `com.apple.developer.kernel.extended-virtual-addressing` set to true in app.json infoPlist. Note: requires paid Apple Developer account and proper entitlements file when building.
3. useModel hook added at `src/hooks/useGemmaModel.ts` and wired into HomeScreen.

Next steps to run on device:
- Run: `npx expo prebuild --clean` to apply native plugin
- Android: `npx expo run:android` on an ARM64 device
- iOS: ensure entitlement & paid account; `npx expo run:ios` (device) or run on simulator

Notes:
- Models are large (2.58 GB). Ensure device has enough storage and memory (4+ GB recommended).
- Use `GEMMA_4_E2B_IT` constant from library; the hook uses backend: 'cpu' by default but change to 'gpu' if device supports Metal/MPS or Android GPU delegate.
