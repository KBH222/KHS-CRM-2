import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Router } from './router';
import { initializeServices, cleanupServices } from './services';
import { simpleBackupService } from './services/simpleBackup.service';
import { AuthSetup } from './components/AuthSetup';
import { LoginForm } from './components/LoginForm';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// Initialize sync service - DISABLED in dev to fix 2-second refresh
if (import.meta.env.PROD) {
  import('./services/init');
}

// Create a client optimized for construction field work
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - keep data fresh for field workers
      gcTime: 30 * 60 * 1000, // 30 minutes - longer cache for offline scenarios
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        // Retry network errors more aggressively for field conditions
        if (error?.code === 'NETWORK_ERROR' || error?.status >= 500) {
          return failureCount < 5;
        }
        // Don't retry on 4xx client errors (except auth)
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Progressive backoff for field conditions
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      networkMode: 'offlineFirst', // Prioritize offline-first for field workers
    },
    mutations: {
      retry: 3,
      networkMode: 'offlineFirst',
    },
  },
});

// Store query client globally for debugging
(window as any).__REACT_QUERY_CLIENT__ = queryClient;

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsAuthSetup, setNeedsAuthSetup] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    // Initialize all services
    const initializeApp = async () => {
      try {
        // Check for pending restore BEFORE initializing other services
        const hadPendingRestore = await simpleBackupService.checkPendingRestore();
        
        await initializeServices();
        setIsInitialized(true);
        
        // If we restored data, clear React Query cache to force refetch
        if (hadPendingRestore) {
          console.log('[App] Restore detected, clearing React Query cache');
          queryClient.clear();
          queryClient.invalidateQueries();
          
          // Give React Query time to refetch
          setTimeout(() => {
            console.log('[App] Reloading after restore');
            window.location.reload();
          }, 500);
        }
      } catch (error) {
        // Failed to initialize application
        setIsInitialized(true); // Show the app even with initialization errors
      }
    };

    initializeApp();

    // Cleanup function
    return () => {
      cleanupServices();
    };
  }, []);

  // Loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing KHS CRM</h2>
          <p className="text-gray-600">Setting up offline capabilities...</p>
        </div>
      </div>
    );
  }

  // Skip onboarding for practical use

  // Show auth setup if needed
  if (needsAuthSetup) {
    return (
      <AuthSetup
        onComplete={() => {
          setNeedsAuthSetup(false);
          setNeedsLogin(true);
        }}
      />
    );
  }

  // Show login if needed
  if (needsLogin) {
    return <LoginForm />;
  }

  // Main app
  // Verify all components are defined
  if (!QueryClientProvider) {
    console.error('QueryClientProvider is undefined!');
    return <div>Error: QueryClientProvider not loaded</div>;
  }
  if (!BrowserRouter) {
    console.error('BrowserRouter is undefined!');
    return <div>Error: BrowserRouter not loaded</div>;
  }
  if (!Router) {
    console.error('Router is undefined!');
    return <div>Error: Router not loaded</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Router />
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;