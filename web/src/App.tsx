import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './routes/AppRouter';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Failures surface at once as the screen's error banner; Retry is the user's choice.
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });
}

export const App: React.FC = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
