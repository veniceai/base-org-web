'use client';

import { useCallback, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import classNames from 'classnames';
import logEvent, { ActionType, AnalyticsEventImportance } from 'base-ui/utils/logEvent';
import sanitizeEventString from 'base-ui/utils/sanitizeEventString';
import { useCopyToClipboard } from 'usehooks-ts';
import QRCode from 'qrcode.react';

const BASESCAN_URL = 'https://basescan.org';

/**
 * Custom implementation of WalletAdvancedWalletActions that properly handles
 * the disconnect functionality using wagmi's useDisconnect hook.
 *
 * This component addresses an issue where the OnchainKit WalletAdvancedWalletActions
 * disconnect button may not work properly in certain states (e.g., when the user's
 * authentication session has expired but the wallet is still connected).
 *
 * The key differences from OnchainKit's implementation:
 * 1. Uses disconnectAsync for proper async handling
 * 2. Iterates through ALL connectors to ensure complete disconnect
 * 3. Proper error handling and logging
 */
export function CustomWalletAdvancedWalletActions() {
  const { isConnected, connector, address, chain } = useAccount();
  const { disconnect, disconnectAsync, connectors, isPending } = useDisconnect();
  const [, copy] = useCopyToClipboard();
  const [showQRCode, setShowQRCode] = useState(false);
  const [copyText, setCopyText] = useState('Copy');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);

    // Log the disconnect attempt for analytics
    logEvent(
      'wallet_disconnect_initiated',
      {
        action: ActionType.click,
        context: 'wallet_advanced',
        address: address ?? 'unknown',
        wallet_type: sanitizeEventString(connector?.name),
        wallet_connector_id: connector?.id,
        connectors_count: connectors.length,
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
          // Log but continue - one connector failing shouldn't prevent others
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
  }, [disconnectAsync, connectors, connector, address, isDisconnecting]);

  const handleViewExplorer = useCallback(() => {
    if (!address) return;
    const explorerUrl = chain?.blockExplorers?.default?.url ?? BASESCAN_URL;
    window.open(`${explorerUrl}/address/${address}`, '_blank', 'noopener,noreferrer');
  }, [address, chain]);

  const handleShowQRCode = useCallback(() => {
    setShowQRCode((prev) => !prev);
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (address) {
      copy(address)
        .then(() => {
          setCopyText('Copied!');
          setTimeout(() => setCopyText('Copy'), 2000);
        })
        .catch(console.error);
    }
  }, [address, copy]);

  if (!isConnected) {
    return null;
  }

  const actionButtonClasses = classNames(
    'flex flex-col items-center justify-center gap-1 rounded-lg p-2',
    'text-xs font-medium',
    'transition-colors duration-200',
    'ock-text-foreground-muted',
    'hover:bg-[var(--ock-bg-alternate-hover)]',
    'min-w-[60px]',
  );

  return (
    <div
      className={classNames(
        'relative flex w-full items-center justify-center gap-1 py-2',
        'ock-font-family',
      )}
      data-testid="ockWalletAdvanced_WalletActions"
    >
      <button
        type="button"
        onClick={handleCopyAddress}
        className={actionButtonClasses}
        data-testid="ockWalletAdvanced_CopyButton"
      >
        <CopyIcon />
        <span>{copyText}</span>
      </button>
      <button
        type="button"
        onClick={handleShowQRCode}
        className={actionButtonClasses}
        data-testid="ockWalletAdvanced_QRCodeButton"
      >
        <QRCodeIcon />
        <span>QR Code</span>
      </button>
      <button
        type="button"
        onClick={handleViewExplorer}
        className={actionButtonClasses}
        data-testid="ockWalletAdvanced_ExplorerButton"
      >
        <ExplorerIcon />
        <span>Explorer</span>
      </button>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={isPending || isDisconnecting}
        data-testid="ockWalletAdvanced_DisconnectButton"
        className={classNames(
          actionButtonClasses,
          'hover:text-[var(--ock-text-error)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isPending || isDisconnecting ? <DisconnectSpinner /> : <DisconnectIcon />}
        <span>{isPending || isDisconnecting ? 'Disconnecting' : 'Disconnect'}</span>
      </button>
      {showQRCode && address && (
        <div
          className={classNames(
            'absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2',
            'rounded-lg p-4 shadow-lg',
            'ock-bg-default ock-border-default border',
          )}
        >
          <QRCode value={address} size={128} />
        </div>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QRCodeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 14H21V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 21H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExplorerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 3H21V9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14L21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
