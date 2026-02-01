'use client';

import { useCallback, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import classNames from 'classnames';
import logEvent, { ActionType, AnalyticsEventImportance } from 'base-ui/utils/logEvent';
import sanitizeEventString from 'base-ui/utils/sanitizeEventString';

/**
 * Custom disconnect button that properly handles wallet disconnection.
 *
 * This fixes an issue in OnchainKit's WalletAdvancedWalletActions where
 * disconnect() is called without awaiting, causing silent failures with
 * stale WalletConnect sessions.
 *
 * The fix: use disconnectAsync and await each connector disconnect.
 */
export function CustomWalletDisconnectButton() {
  const { connector, address } = useAccount();
  const { disconnectAsync, connectors, isPending } = useDisconnect();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting || isPending) return;
    setIsDisconnecting(true);

    logEvent(
      'wallet_disconnect_initiated',
      {
        action: ActionType.click,
        context: 'wallet_advanced',
        address: address ?? 'unknown',
        wallet_type: sanitizeEventString(connector?.name),
        wallet_connector_id: connector?.id,
      },
      AnalyticsEventImportance.low,
    );

    try {
      // Disconnect all connectors properly using async/await
      // This is the key fix - OnchainKit's version doesn't await these calls
      for (const conn of connectors) {
        try {
          await disconnectAsync({ connector: conn });
        } catch (connectorError) {
          console.warn(`Failed to disconnect connector ${conn.name}:`, connectorError);
        }
      }

      logEvent(
        'wallet_disconnected',
        {
          action: ActionType.change,
          context: 'wallet_advanced',
          address: address ?? 'unknown',
          wallet_type: sanitizeEventString(connector?.name),
        },
        AnalyticsEventImportance.low,
      );
    } catch (error) {
      console.error('Error during disconnect:', error);
      logEvent(
        'wallet_disconnect_error',
        {
          action: ActionType.error,
          context: 'wallet_advanced',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        AnalyticsEventImportance.high,
      );
    } finally {
      setIsDisconnecting(false);
    }
  }, [disconnectAsync, connectors, connector, address, isDisconnecting, isPending]);

  const isLoading = isPending || isDisconnecting;

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={isLoading}
      data-testid="ockCustomDisconnectButton"
      className={classNames(
        'ock-font-family',
        'flex items-center justify-center',
        'rounded-lg px-3 py-2',
        'text-sm font-medium',
        'transition-colors duration-200',
        'ock-text-foreground-muted hover:ock-text-error',
        'hover:bg-[var(--ock-bg-alternate-hover)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {isLoading ? <DisconnectSpinner /> : <DisconnectIcon />}
      <span className="ml-2">{isLoading ? 'Disconnecting...' : 'Disconnect'}</span>
    </button>
  );
}

function DisconnectIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17L21 12L16 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DisconnectSpinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
