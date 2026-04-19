import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { I18nProvider } from './lib/i18n.tsx';
import { coinPlanetChain, privyAppId, wagmiConfig } from './lib/wallet.ts';

const queryClient = new QueryClient();

if (!privyAppId) {
  // eslint-disable-next-line no-console
  console.error(
    '[privy] VITE_PRIVY_APP_ID is not set. Wallet login will not work. ' +
      'Set it in .env (get one at https://dashboard.privy.io/).',
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={privyAppId || 'missing-app-id'}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#22d3ee',
          // Show WalletConnect QR option first so mobile users can scan to
          // connect their wallet app. `detected_wallets` covers injected
          // wallets (MetaMask / OKX / TokenPocket browser extensions).
          walletList: [
            'wallet_connect',
            'detected_wallets',
            'metamask',
            'rainbow',
            'coinbase_wallet',
            'okx_wallet',
          ],
          showWalletLoginFirst: true,
        },
        loginMethods: ['wallet', 'email', 'google'],
        externalWallets: {
          walletConnect: { enabled: true },
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: coinPlanetChain,
        supportedChains: [coinPlanetChain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <I18nProvider>
            <App />
          </I18nProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
);
