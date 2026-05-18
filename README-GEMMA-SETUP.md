Gemma 4 E2B setup notes

1. The app uses `react-native-litert-lm` with the public `GEMMA_4_E2B_IT` HTTPS URL.
2. `useGemmaModel` lives under `src/features/model/hooks/useGemmaModel.ts` and wraps the package hook with a default system prompt.
3. No HuggingFace token onboarding is needed for the current flow.

Notes:
- The model URL is fetched over normal HTTPS through the package.
- The hook keeps backend selection and load state in one place so the rest of the app can stay domain-oriented.
