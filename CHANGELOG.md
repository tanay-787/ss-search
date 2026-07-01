# Changelog

## [1.1.0](https://github.com/tanay-787/refind/compare/refind-v1.0.0...refind-v1.1.0) (2026-07-01)


### Features

* **core:** add retry functionality for failed job executions ([5da3705](https://github.com/tanay-787/refind/commit/5da37055abd16699ca0c48e6cc0b2f69ef03fafe))
* **docs:** add core product story behind 'Refind' ([ee8efee](https://github.com/tanay-787/refind/commit/ee8efeef065883b0571f8be754768f9bf2438fec))
* **library:** implement Material 3 status dashboard and live peek ([be4e483](https://github.com/tanay-787/refind/commit/be4e48315406cdb8832f0a9973c29ae6f98c3a78))
* **library:** migrate from FlatList to Shopify's FlashList for rendering screenshots ([0bf6282](https://github.com/tanay-787/refind/commit/0bf62820bc3dd9b54eb32347065e7e3a8b2156dc))
* **library:** support paginated loading of all available screenshots ([1f4412f](https://github.com/tanay-787/refind/commit/1f4412fe0fa7ecc136d0c3e1db4dbe2ddcbd3c46))
* **onboarding:** add centralize Permissions Management ([8cf6f1e](https://github.com/tanay-787/refind/commit/8cf6f1ed180020425b2e4a363d2afcd90ed6c39f))
* **permissions:** add native Snackbar warning for denied/limited permission states ([0a4980c](https://github.com/tanay-787/refind/commit/0a4980cdbb65eb9f10e7f06f2015132d58a61536))
* renamed to 'Refind' ([7fa68fd](https://github.com/tanay-787/refind/commit/7fa68fdeb102dc3a37b0828abdfb5a4f96602d49))
* **search:** cap live search results to 12 top matches for better UX ([8af3f7f](https://github.com/tanay-787/refind/commit/8af3f7f915de69cf34137c96ad54154dfa6a0b03))
* **theme:** migrate to native Jetpack Compose theming via expo/ui's Host and Surface ([b2967f0](https://github.com/tanay-787/refind/commit/b2967f060d0bbbae5fb7992e79df86135feeb098))
* **typography:** add fonts and use them across the app ([f12a458](https://github.com/tanay-787/refind/commit/f12a458090344185c531b9ed47f618248e1e64c6))
* **ui:** add footer to Screenshot List ([817a2f7](https://github.com/tanay-787/refind/commit/817a2f7c6ea316a162219801a14d9368e14d7965))
* **ui:** immersive ImageViewer with FlashList migration and gallery-like gesture physics ([921a3e3](https://github.com/tanay-787/refind/commit/921a3e34c103bbfd159e678384ef7c7793fca03e))
* **ui:** implement dynamic masonry layout with aspect-ratio row chunking ([9cf223b](https://github.com/tanay-787/refind/commit/9cf223b35a40ba1136cb244da0060e551306477f))
* **ui:** redesign home ui ([ccde8f2](https://github.com/tanay-787/refind/commit/ccde8f20d88d7d7ef97b82207b44b56ab41909b2))


### Bug Fixes

* asset path ([b419786](https://github.com/tanay-787/refind/commit/b419786fc02570a0c7603fd8e6c2a1fab8b7dbaf))
* **core:** count job-level statuses instead of stage executions ([99ea445](https://github.com/tanay-787/refind/commit/99ea4454ce08f5c0483dbb6c8058c0c62c94e2f8))
* **permissions:** re-evaluate permission status on app foreground ([a0c1be8](https://github.com/tanay-787/refind/commit/a0c1be860839d6ae2eb6a008534cbd76dae69295))


### Performance Improvements

* **core:** batch insert keyword results in keywords stage ([9d8eea9](https://github.com/tanay-787/refind/commit/9d8eea972a415c12c14c2f829e2278a80a425b6d))
* **core:** optimize screenshot intake for bulk workload ([67d9aa0](https://github.com/tanay-787/refind/commit/67d9aa034f0fac05354ca58564803880096e8630))
* **library:** optimize stage execution left join and increase limit ([1608451](https://github.com/tanay-787/refind/commit/160845143f20f14b0809eb281eab07d912f4f1f4))
* **ui:** migrate ListItems to pure RN components ([49a7c80](https://github.com/tanay-787/refind/commit/49a7c80a9c6e2c4ff55661a963aff0463919012e))
* **ui:** optimize home screen rendering and resolve icon flicker ([afd2267](https://github.com/tanay-787/refind/commit/afd2267be8b52f6aad5b2583dd8fd199921e2a78))
* **ui:** optimize rendering of screenshots ([e16941f](https://github.com/tanay-787/refind/commit/e16941fa540bfad430772d1a312bbb928e5abbe0))
* **ui:** optimize UI to use expo/ui best practices ([88112a5](https://github.com/tanay-787/refind/commit/88112a554f026b141882aadf4469002d843cb5ee))
