.
├── ARCHITECTURE_DIAGRAMS.md
├── README.md
├── app
│   ├── (modals)
│   │   ├── _layout.tsx
│   │   ├── add-item.tsx
│   │   ├── create-list.tsx
│   │   └── edit-item.tsx
│   ├── (tabs)
│   │   ├── _layout.tsx
│   │   ├── barcode.tsx
│   │   ├── index.tsx
│   │   ├── settings.tsx
│   │   └── storefront.tsx
│   ├── _layout.tsx
│   └── list
│       └── [id].tsx
├── app.json
├── assets
│   ├── icons
│   ├── images
│   │   ├── android-icon-background.png
│   │   ├── android-icon-foreground.png
│   │   ├── android-icon-monochrome.png
│   │   ├── favicon.png
│   │   ├── icon.png
│   │   ├── partial-react-logo.png
│   │   ├── react-logo.png
│   │   ├── react-logo@2x.png
│   │   ├── react-logo@3x.png
│   │   └── splash-icon.png
│   ├── splash
│   └── styles
│       ├── home.styles.ts
│       └── settings.styles.ts
├── components
│   ├── DangerZone.tsx
│   ├── EmptyState.tsx
│   ├── Header.tsx
│   ├── LoadingSpinner.tsx
│   ├── Preferences.tsx
│   ├── ProgressStats.tsx
│   ├── TodoInput.tsx
│   ├── lists
│   │   ├── AddItemForm.tsx
│   │   └── CreateListForm.tsx
│   ├── stores
│   │   ├── SeedStoresButton.tsx
│   │   └── StoreSelector.tsx
│   └── ui
│       ├── actionsheet
│       ├── alert
│       └── dialog
├── convex
│   ├── README.md
│   ├── _generated
│   │   ├── api.d.ts
│   │   ├── api.js
│   │   ├── dataModel.d.ts
│   │   ├── server.d.ts
│   │   └── server.js
│   ├── listItems.ts
│   ├── lists.ts
│   ├── productLearning.ts
│   ├── purchases.ts
│   ├── schema.ts
│   ├── stores.ts
│   └── tsconfig.json
├── data
│   ├── categories.json
│   ├── items.json
│   ├── stores.json
│   └── units.json
├── docs
│   ├── ARCHITECTURE_DIAGRAMS.md
│   ├── CONVEX_SCHEMA_FULL.md
│   ├── DATABASE_DIAGRAM.md
│   ├── PROJECT_ROADMAP.md
│   ├── PROJECT_STRUCTURE_REFERENCE.md
│   ├── SHopp_DEVELOPMENT_GUIDE.md
│   ├── shopp_architecture.md
│   ├── shopp_convex_schema.md
│   └── shopp_data_model.md
├── eslint.config.js
├── expo-env.d.ts
├── hooks
│   ├── useLists.tsx
│   ├── useProducts.tsx
│   ├── usePurchases.tsx
│   ├── useStores.tsx
│   └── useTheme.tsx
├── legacy
│   └── todos.ts
├── legacy_shopp_old
│   ├── App.js
│   ├── README.md
│   ├── app.json
│   ├── assets
│   │   ├── images
│   │   ├── splash-icon-1.png
│   │   ├── splash-icon-2.png
│   │   └── splash-icon.png
│   ├── components
│   │   ├── ActionMenuModal.js
│   │   ├── AppIcon.js
│   │   ├── BarcodeLink.js
│   │   ├── BarcodeScanner.js
│   │   ├── BarcodeScannerEAN13.js
│   │   ├── CantidadPrecioInputs.js
│   │   ├── CheckoutBar.js
│   │   ├── CurrencyBadge.js
│   │   ├── DebugBanner.js
│   │   ├── EditBarcode.js
│   │   ├── EditName.js
│   │   ├── ItemRow.js
│   │   ├── NewItemInput.js
│   │   ├── OfertaSelector.js
│   │   ├── PrecioPromocion.js
│   │   ├── PrimaryButton.js
│   │   ├── RenameListName.js
│   │   ├── ScannerControls.js
│   │   ├── SearchBar.js
│   │   ├── SearchBarBasic.js
│   │   ├── SearchCombinedBar.js
│   │   ├── SmartSearchBar.js
│   │   ├── StoreCard.js
│   │   ├── StoreFilterBadges.js
│   │   ├── StoreMapPreview.native.js
│   │   ├── StoreMapPreview.web.js
│   │   ├── StoreRow.js
│   │   ├── StoreSearchLink.js
│   │   ├── StoreSelector.js
│   │   ├── StoresMap.native.js
│   │   ├── StoresMap.web.js
│   │   ├── TotalBox.js
│   │   └── UnidadSelector.js
│   ├── config
│   │   └── config.default.json
│   ├── constants
│   │   ├── cameraZoom.js
│   │   ├── config.js
│   │   ├── currency.js
│   │   ├── index.js
│   │   ├── searchEngines.js
│   │   └── unitTypes.js
│   ├── context
│   │   ├── ConfigContext.js
│   │   ├── ListsContext.js
│   │   ├── LocationContext.js
│   │   ├── ProductLearningContext.js
│   │   ├── ProductSuggestionsContext.js
│   │   ├── PurchasesContext.js
│   │   └── StoresContext.js
│   ├── data
│   │   ├── equipos_tercera.json
│   │   ├── items.json
│   │   ├── searchSites.json
│   │   ├── search_engines.json
│   │   └── stores.json
│   ├── hooks
│   │   └── useStoresWithDistance.js
│   ├── index.js
│   ├── md
│   │   ├── git-file.md
│   │   ├── githubcli.md
│   │   ├── info.md
│   │   ├── origin.md
│   │   └── progress.md
│   ├── navigation
│   │   ├── ArchivedStack.js
│   │   ├── HistoryStack.js
│   │   ├── MainTabs.js
│   │   ├── MenuStack.js
│   │   ├── ROUTES.js
│   │   ├── ScannerStack.js
│   │   ├── ShoppingStack.js
│   │   └── StoresStack.js
│   ├── package.json
│   ├── screens
│   │   ├── ArchivedListsScreen.js
│   │   ├── EditScannedItemScreen.js
│   │   ├── ItemDetailScreen.js
│   │   ├── MenuScreen copy 2.js
│   │   ├── MenuScreen copy.js
│   │   ├── MenuScreen.js
│   │   ├── ProductLearningDebugScreen.js
│   │   ├── PurchaseDetailScreen.js
│   │   ├── PurchaseHistoryScreen.js
│   │   ├── ScannedHistoryScreen.js
│   │   ├── ScannerTab.js
│   │   ├── SettingsScreen.js
│   │   ├── ShoppingListScreen.js
│   │   ├── ShoppingListsScreen.js
│   │   ├── SplashScreen.js
│   │   ├── StoreDetailScreen.js
│   │   ├── StoreInfoScreen.js
│   │   ├── StoreMapScreen.js
│   │   ├── StoreSelectScreen.js
│   │   ├── StoresBrowseScreen.js
│   │   ├── StoresFavoritesScreen.js
│   │   ├── StoresHomeScreen.js
│   │   ├── StoresNearbyScreen.js
│   │   └── StoresScreen.js
│   ├── services
│   │   ├── nominatim.service.js
│   │   ├── overpass.service.js
│   │   ├── productLookUp.js
│   │   ├── scannerHistory.js
│   │   └── storeProvider.js
│   └── utils
│       ├── buildPurchaseHistoryFromArchivedLists.js
│       ├── config
│       ├── core
│       ├── createThumbnail.js
│       ├── cryptoid.js
│       ├── dev
│       ├── generateStores.js
│       ├── helpers
│       ├── index.js
│       ├── location
│       ├── maps
│       ├── math
│       ├── normalize.js
│       ├── pricing
│       ├── products
│       ├── queries
│       ├── search
│       ├── storage
│       ├── store
│       ├── tools
│       └── validation.js
├── package.json
├── src
│   ├── domain
│   │   ├── lists
│   │   ├── pricing
│   │   ├── products
│   │   └── stores
│   ├── features
│   ├── lib
│   │   ├── loadApp.ts
│   │   └── normalizeProductName.ts
│   ├── seeds
│   │   └── stores.ts
│   └── types
│       ├── list.ts
│       ├── pricing.ts
│       ├── product.ts
│       └── store.ts
├── treel3.md
└── tsconfig.json

61 directories, 191 files
