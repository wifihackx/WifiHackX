/**
 * Firebase Modular SDK Initialization
 * Migrated from compat SDK to reduce bundle size by ~40KB
 *
 * @version 1.0.0
 * @requires firebase/app@10.14.1
 * @requires firebase/auth@10.14.1
 * @requires firebase/firestore@10.14.1
 * @requires firebase/storage@10.14.1
 */

// Import Firebase modular SDK functions (dynamic, with fallback CDN)
const FIREBASE_SDK_VERSION = '10.14.1';
const FIREBASE_SDK_BASE_URLS = [
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`,
    `https://cdn.jsdelivr.net/npm/firebase@${FIREBASE_SDK_VERSION}/`,
];

const firebaseModuleCache = new Map();

async function loadFirebaseModule(moduleName) {
    if (firebaseModuleCache.has(moduleName)) {
        return firebaseModuleCache.get(moduleName);
    }

    let lastError = null;
    for (const base of FIREBASE_SDK_BASE_URLS) {
        const url = `${base}firebase-${moduleName}.js`;
        try {
            const mod = await import( /* @vite-ignore */ url);
            firebaseModuleCache.set(moduleName, mod);
            return mod;
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error(`Failed to load firebase-${moduleName}.js`);
}

// Firebase Configuration (runtime, injected from index runtime-config)
const firebaseConfig =
    (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.firebase) || {};

async function initFirebase() {
    const logger = window.Logger || console;
    const logSection =
        (logger && typeof logger.section === 'function' && logger.section) ||
        function() {};
    const logDebug =
        (logger && typeof logger.debug === 'function' && logger.debug) ||
        function() {};
    const logInfo =
        (logger && typeof logger.info === 'function' && logger.info) ||
        function() {};
    const logWarn =
        (logger && typeof logger.warn === 'function' && logger.warn) ||
        function() {};
    const logError =
        (logger && typeof logger.error === 'function' && logger.error) ||
        function() {};

    logSection('Firebase Initialization');
    const startTime = window.performance.now();

    logDebug('Loading modular Firebase SDK in parallel...', 'FIREBASE');

    const [appMod, authMod, firestoreMod, storageMod, functionsMod] = await Promise.all([
        loadFirebaseModule('app'),
        loadFirebaseModule('auth'),
        loadFirebaseModule('firestore'),
        loadFirebaseModule('storage'),
        loadFirebaseModule('functions')
    ]);

    const {
        initializeApp
    } = appMod;
    const {
        getAuth,
        signInWithEmailAndPassword,
        fetchSignInMethodsForEmail,
        createUserWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
        sendPasswordResetEmail,
        sendEmailVerification,
        GoogleAuthProvider,
        signInWithPopup,
        signInWithRedirect,
        getRedirectResult,
        setPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
        RecaptchaVerifier,
    } = authMod;
    const {
        initializeFirestore,
        getFirestore,
        collection,
        doc,
        getDoc,
        getDocFromServer,
        getDocs,
        setDoc,
        addDoc,
        updateDoc,
        deleteDoc,
        onSnapshot,
        query,
        where,
        orderBy,
        limit,
        getCountFromServer,
        serverTimestamp,
        Timestamp,
        deleteField,
        arrayUnion,
        arrayRemove,
        increment,
        writeBatch,
    } = firestoreMod;
    const {
        getStorage,
        ref: storageRef,
        uploadBytes,
        getDownloadURL,
        deleteObject,
    } = storageMod;
    const {
        getFunctions,
        httpsCallable
    } = functionsMod;

    let app;
    try {
        app = initializeApp(firebaseConfig);
    } catch (error) {
        // If already initialized, reuse existing app.
        if (error && error.code === 'app/duplicate-app') {
            const {
                getApp
            } = appMod;
            app = getApp();
        } else {
            throw error;
        }
    }

    // Defensive: if app options are empty (bad init), re-init with config.
    if (!app?.options || !app.options.projectId) {
        const {
            deleteApp,
            getApp
        } = appMod;
        try {
            const current = getApp();
            await deleteApp(current);
        } catch (_) {
            // ignore
        }
        app = initializeApp(firebaseConfig);
    }
    const auth = getAuth(app);
    const isFirefox =
        typeof navigator !== 'undefined' &&
        /firefox/i.test(navigator.userAgent || '');
    const firestoreSettings = isFirefox
        ? {
              experimentalForceLongPolling: true,
              useFetchStreams: false,
          }
        : null;

    let db;
    try {
        db = firestoreSettings
            ? initializeFirestore(app, firestoreSettings)
            : getFirestore(app);
    } catch (error) {
        logWarn(
            'initializeFirestore fallback to getFirestore',
            'FIREBASE',
            error
        );
        db = getFirestore(app);
    }
    const storage = getStorage(app);
    const resolveFunctionsRegion = () =>
        window.RuntimeConfigUtils &&
        typeof window.RuntimeConfigUtils.getFunctionsRegion === 'function'
            ? window.RuntimeConfigUtils.getFunctionsRegion('us-central1')
            : 'us-central1';
    const functionsRegion = resolveFunctionsRegion();
    const functions = getFunctions(app, functionsRegion);

    // Configure session persistence
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            if (window.Logger && window.Logger.trace) {
                window.Logger.trace(
                    'Session persistence configured (localStorage)',
                    'FIREBASE'
                );
            } else {
                logDebug('Session persistence configured', 'FIREBASE');
            }
        })
        .catch(error => {
            logError('Error configuring persistence', 'FIREBASE', error);
        });

    // ✅ Initialize AuthManager with the modular auth instance
    if (window.AuthManager) {
        window.AuthManager.initializeAuthListeners(auth);
    }

    // Export for use in other modules
    window.firebaseApp = app;
    window.auth = auth;
    window.db = db;
    window.storage = storage;
    window.functions = functions;
    window.firebaseConfig = firebaseConfig;

    // Cached admin claims helper to avoid quota-exceeded
    window.getAdminClaims = async function(user, forceRefresh = false) {
        if (!user || !user.getIdTokenResult) return {};
        const now = Date.now();
        const cache = window.__adminClaimsCache || {};
        if (
            !forceRefresh &&
            cache.uid === user.uid &&
            cache.ts &&
            now - cache.ts < 60000
        ) {
            return cache.claims || {};
        }
        try {
            const shouldRefresh = forceRefresh || cache.uid !== user.uid || !cache.ts;
            const tokenResult = await user.getIdTokenResult(!!shouldRefresh);
            const claims = tokenResult?.claims || {};
            window.__adminClaimsCache = {
                uid: user.uid,
                claims,
                ts: now
            };
            return claims;
        } catch (error) {
            if (cache.uid === user.uid) {
                return cache.claims || {};
            }
            throw error;
        }
    };

    // Dispatch initialization event for dependent services
    window.dispatchEvent(
        new CustomEvent('firebase:initialized', {
            detail: {
                app,
                auth,
                db,
                storage,
                functions,
                timestamp: new Date().toISOString(),
            },
        })
    );

    logDebug('Firebase initialization event dispatched', 'FIREBASE');

    // Export modular functions for direct use
    window.firebaseModular = {
        // ... (sin cambios en las exportaciones)
        app,
        auth,
        signInWithEmailAndPassword,
        fetchSignInMethodsForEmail,
        createUserWithEmailAndPassword,
        signOut,
        onAuthStateChanged,
        sendPasswordResetEmail,
        sendEmailVerification,
        GoogleAuthProvider,
        signInWithPopup,
        db,
        collection,
        doc,
        getDoc,
        getDocFromServer,
        getDocs,
        getCountFromServer, // ✅ Expuesto para el Dashboard
        setDoc,
        addDoc,
        updateDoc,
        deleteDoc,
        onSnapshot,
        query,
        where,
        orderBy,
        limit,
        serverTimestamp,
        Timestamp,
        deleteField,
        arrayUnion,
        arrayRemove,
        increment,
        writeBatch, // ✅ Expuesto para el Dashboard
        storage,
        storageRef,
        uploadBytes,
        getDownloadURL,
        deleteObject,
        functions,
        httpsCallable: name => httpsCallable(functions, name),
    };

    // Backward compatibility layer for compat SDK
    window.firebase = window.firebase || {};

    logSection('Firebase Shim Layer');

    // Create compat-style auth() function
    window.firebase.auth = function() {
        const authInstance = {
            get currentUser() {
                const user = auth.currentUser;
                if (!user) return null;

                // Wrap the user object to add all necessary methods
                return {
                    ...user,
                    sendEmailVerification: () => sendEmailVerification(user),
                    updateProfile: profile => {
                        // Import updateProfile if needed
                        return user.updateProfile(profile);
                    },
                    getIdTokenResult: forceRefresh => user.getIdTokenResult(forceRefresh),
                    getIdToken: forceRefresh => user.getIdToken(forceRefresh),
                };
            },
            signInWithEmailAndPassword: (email, password) =>
                signInWithEmailAndPassword(auth, email, password),
            fetchSignInMethodsForEmail: email =>
                fetchSignInMethodsForEmail(auth, email),
            createUserWithEmailAndPassword: (email, password) =>
                createUserWithEmailAndPassword(auth, email, password),
            signOut: () => signOut(auth),
            setPersistence: persistence =>
                setPersistence(auth, persistence || browserLocalPersistence),
            onAuthStateChanged: callback => {
                // Hook into AuthManager if available to prevent duplicates
                if (window.AuthManager) {
                    window.AuthManager.registerUniqueAuthHandler(
                        'shim_' + Math.random().toString(36).substr(2, 5),
                        callback
                    );
                    return () => {}; // AuthManager handles its own cleanup
                }
                return onAuthStateChanged(auth, callback);
            },
            sendPasswordResetEmail: email => sendPasswordResetEmail(auth, email),
            signInWithPopup: provider => signInWithPopup(auth, provider),
            signInWithRedirect: provider => signInWithRedirect(auth, provider),
            getRedirectResult: () => getRedirectResult(auth),
            useDeviceLanguage: () => {
                auth.useDeviceLanguage();
                logDebug('Device language set via shim', 'FIREBASE');
            },
            Auth: {
                Persistence: {
                    LOCAL: browserLocalPersistence,
                    SESSION: browserSessionPersistence,
                    NONE: inMemoryPersistence,
                },
            },
            GoogleAuthProvider: GoogleAuthProvider,
            RecaptchaVerifier: RecaptchaVerifier,
        };
        if (window.Logger && window.Logger.trace) {
            window.Logger.trace('auth() called via shim', 'FIREBASE');
        }
        return authInstance;
    };

    // Prime admin claims cache on auth state changes
    try {
        if (auth && auth.onAuthStateChanged) {
            auth.onAuthStateChanged(user => {
                if (user && window.getAdminClaims) {
                    window.getAdminClaims(user, true).catch(() => {});
                } else {
                    window.__adminClaimsCache = {};
                }
            });
        }
    } catch (_e) {}

    // Static GoogleAuthProvider on firebase.auth itself
    window.firebase.auth.GoogleAuthProvider = GoogleAuthProvider;
    window.firebase.auth.RecaptchaVerifier = RecaptchaVerifier;

    // Create compat-style firestore() function
    window.firebase.firestore = function() {
        const unwrapDocRef = ref => (ref && ref._ref ? ref._ref : ref);
        const firestoreCompat = {
            // ... (resto de funciones compat sin cambios en lógica)
            collection: collectionPath => {
                const collectionRef = collection(db, collectionPath);
                return {
                    doc: docId => {
                        const docRef = docId ?
                            doc(db, collectionPath, docId) :
                            doc(collectionRef);
                        return {
                            _ref: docRef,
                            get: () => getDoc(docRef),
                            set: data => setDoc(docRef, data),
                            update: data => updateDoc(docRef, data),
                            delete: () => deleteDoc(docRef),
                            onSnapshot: (callback, errorCallback) =>
                                onSnapshot(docRef, callback, errorCallback),
                            collection: subCollectionPath => {
                                const subCollectionRef = collection(docRef, subCollectionPath);
                                return {
                                    doc: subDocId => {
                                        const subDocRef = subDocId ?
                                            doc(
                                                db,
                                                collectionPath,
                                                docId,
                                                subCollectionPath,
                                                subDocId
                                            ) :
                                            doc(subCollectionRef);
                                        return {
                                            _ref: subDocRef,
                                            get: () => getDoc(subDocRef),
                                            set: data => setDoc(subDocRef, data),
                                            update: data => updateDoc(subDocRef, data),
                                            delete: () => deleteDoc(subDocRef),
                                            onSnapshot: (callback, errorCallback) =>
                                                onSnapshot(subDocRef, callback, errorCallback),
                                            id: subDocRef.id,
                                        };
                                    },
                                    add: async data => {
                                        const newSubDocRef = await addDoc(subCollectionRef, data);
                                        return {
                                            _ref: newSubDocRef,
                                            id: newSubDocRef.id,
                                            get: () => getDoc(newSubDocRef),
                                            set: data => setDoc(newSubDocRef, data),
                                            update: data => updateDoc(newSubDocRef, data),
                                            delete: () => deleteDoc(newSubDocRef),
                                            onSnapshot: (callback, errorCallback) =>
                                                onSnapshot(newSubDocRef, callback, errorCallback),
                                        };
                                    },
                                    get: () => getDocs(subCollectionRef),
                                    where: (field, operator, value) => {
                                        const q = query(
                                            subCollectionRef,
                                            where(field, operator, value)
                                        );
                                        return createQueryWrapper(
                                            q,
                                            `${collectionPath}/${docId}/${subCollectionPath}`
                                        );
                                    },
                                    orderBy: (field, direction = 'asc') => {
                                        const q = query(subCollectionRef, orderBy(field, direction));
                                        return createQueryWrapper(
                                            q,
                                            `${collectionPath}/${docId}/${subCollectionPath}`
                                        );
                                    },
                                    limit: limitCount => {
                                        const q = query(subCollectionRef, limit(limitCount));
                                        return createQueryWrapper(
                                            q,
                                            `${collectionPath}/${docId}/${subCollectionPath}`
                                        );
                                    },
                                    onSnapshot: (callback, errorCallback) =>
                                        onSnapshot(subCollectionRef, callback, errorCallback),
                                };
                            },
                            id: docRef.id,
                        };
                    },
                    add: async data => {
                        const newDocRef = await addDoc(collectionRef, data);
                        return {
                            _ref: newDocRef,
                            id: newDocRef.id,
                            get: () => getDoc(newDocRef),
                            set: data => setDoc(newDocRef, data),
                            update: data => updateDoc(newDocRef, data),
                            delete: () => deleteDoc(newDocRef),
                            onSnapshot: (callback, errorCallback) =>
                                onSnapshot(newDocRef, callback, errorCallback),
                        };
                    },
                    get: () => getDocs(collectionRef),
                    orderBy: (field, direction = 'asc') => {
                        const q = query(collectionRef, orderBy(field, direction));
                        return createQueryWrapper(q, collectionPath);
                    },
                    where: (field, operator, value) => {
                        const q = query(collectionRef, where(field, operator, value));
                        return createQueryWrapper(q, collectionPath);
                    },
                    limit: limitCount => {
                        const q = query(collectionRef, limit(limitCount));
                        return createQueryWrapper(q, collectionPath);
                    },
                    onSnapshot: (callback, errorCallback) =>
                        onSnapshot(collectionRef, callback, errorCallback),
                };
            },
            batch: () => {
                const batch = writeBatch(db);
                return {
                    set: (docRef, data, options) =>
                        batch.set(unwrapDocRef(docRef), data, options),
                    update: (docRef, data) => batch.update(unwrapDocRef(docRef), data),
                    delete: docRef => batch.delete(unwrapDocRef(docRef)),
                    commit: () => batch.commit(),
                };
            },
            FieldValue: {
                serverTimestamp: () => serverTimestamp(),
                delete: () => deleteField(),
                arrayUnion: (...elements) => arrayUnion(...elements),
                arrayRemove: (...elements) => arrayRemove(...elements),
                increment: n => increment(n),
            },
            Timestamp: Timestamp,
        };
        return firestoreCompat;
    };

    // Expose static properties on firebase.firestore function
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => serverTimestamp(),
        delete: () => deleteField(),
        arrayUnion: (...elements) => arrayUnion(...elements),
        arrayRemove: (...elements) => arrayRemove(...elements),
        increment: n => increment(n),
    };
    window.firebase.firestore.Timestamp = Timestamp;

    // Helper function to create query wrapper with chainable methods
    function createQueryWrapper(q, collectionPath) {
        const collectionRef = collection(db, collectionPath);
        return {
            orderBy: (field, direction = 'asc') => {
                const newQuery = query(q, orderBy(field, direction));
                return createQueryWrapper(newQuery, collectionPath);
            },
            where: (field, operator, value) => {
                const newQuery = query(q, where(field, operator, value));
                return createQueryWrapper(newQuery, collectionPath);
            },
            limit: limitCount => {
                const newQuery = query(q, limit(limitCount));
                return createQueryWrapper(newQuery, collectionPath);
            },
            add: async data => {
                const newDocRef = await addDoc(collectionRef, data);
                return {
                    id: newDocRef.id,
                    get: () => getDoc(newDocRef),
                    set: data => setDoc(newDocRef, data),
                    update: data => updateDoc(newDocRef, data),
                    delete: () => deleteDoc(newDocRef),
                    onSnapshot: (callback, errorCallback) =>
                        onSnapshot(newDocRef, callback, errorCallback),
                };
            },
            get: () => getDocs(q),
            onSnapshot: (callback, errorCallback) => {
                logDebug(
                    `[Shim] onSnapshot acting on query for ${collectionPath}`,
                    'FIREBASE'
                );
                return onSnapshot(q, callback, err => {
                    logError(
                        `[Shim] onSnapshot Error for ${collectionPath}:`,
                        'FIREBASE',
                        err
                    );
                    if (errorCallback) errorCallback(err);
                });
            },
        };
    }

    // Create compat-style storage() function
    window.firebase.storage = function() {
        return {
            ref: path => {
                const ref = storageRef(storage, path);
                return {
                    put: file => uploadBytes(ref, file),
                    getDownloadURL: () => getDownloadURL(ref),
                    delete: () => deleteObject(ref),
                };
            },
        };
    };

    // Create compat-style functions() function
    window.firebase.functions = function() {
        return {
            httpsCallable: name => {
                const callable = httpsCallable(functions, name);
                return callable;
            },
        };
    };

    // Mark Firebase as initialized
    window.firebase.apps = [app];
    window.firebase.app = () => app;

    console.groupEnd(); // End Firebase Shim Layer

    logInfo('Firebase Modular SDK initialized', 'FIREBASE');
    if (window.Logger && window.Logger.trace) {
        window.Logger.trace('Bundle size reduced by ~40KB', 'PERF');
        window.Logger.trace('Backward compatibility layer active', 'INIT');
    }

    // Dispatch custom event to notify other scripts that Firebase is ready
    // ✅ UPDATE: Re-assign globals to shimmed versions for legacy script support
    window.auth = window.firebase.auth();
    window.db = window.firebase.firestore();
    window.storage = window.firebase.storage();
    window.functions = window.firebase.functions();

    window.dispatchEvent(new CustomEvent('firebaseReady'));
    if (window.Logger && window.Logger.trace) {
        window.Logger.trace('firebaseReady event dispatched', 'INIT');
    }

    if (window.Logger && window.Logger.perf) {
        window.Logger.perf(
            'Firebase Initial Load',
            'FIREBASE',
            window.performance.now() - startTime
        );
    }

    if (console.groupEnd) console.groupEnd();
}

initFirebase().catch(error => {
    const logger = window.Logger || console;
    if (logger && typeof logger.error === 'function') {
        logger.error('Firebase SDK failed to load', 'FIREBASE', error);
    } else {
        console.error('Firebase SDK failed to load', error);
    }
    window.dispatchEvent(
        new CustomEvent('firebase:init-error', {
            detail: {
                error
            },
        })
    );
});
    if (!firebaseConfig || !firebaseConfig.projectId) {
        throw new Error(
            '[firebase-init-modular] Missing runtime firebase config (window.RUNTIME_CONFIG.firebase)'
        );
    }
