import { useAccount, useChainId } from 'wagmi';
import { coinPlanetChain } from '../lib/wallet';

interface BscBadgeProps {
  className?: string;
  /** Show chain id suffix, e.g. "· Chain 97". Default true. */
  showChainId?: boolean;
  /** Compact variant without label, only chip + dot. */
  compact?: boolean;
}

/**
 * "Built on BNB Smart Chain" badge.
 * When a wallet is connected it also surfaces a live status dot:
 *   green  = connected to the expected chain (BSC Testnet, id 97)
 *   amber  = connected but on a different chain (user needs to switch)
 *   gray   = not connected
 */
export default function BscBadge({ className = '', showChainId = true, compact = false }: BscBadgeProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const expected = coinPlanetChain.id;
  const onExpected = isConnected && chainId === expected;
  const wrongChain = isConnected && chainId !== expected;

  const dotColor = onExpected ? 'bg-emerald-400' : wrongChain ? 'bg-amber-400' : 'bg-slate-500';

  return (
    <span
      className={
        'inline-flex items-center gap-2 rounded-full border border-[#F0B90B]/40 bg-gradient-to-r from-[#F0B90B]/15 to-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#F0B90B] backdrop-blur-sm ' +
        className
      }
      title={wrongChain ? `当前链: ${chainId}，点击切换到 BSC Testnet` : undefined}
    >
      {/* BNB diamond */}
      <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden="true">
        <g transform="translate(16 16) rotate(45)">
          <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#F0B90B" />
        </g>
        <text
          x="16"
          y="21"
          textAnchor="middle"
          fontFamily="'Space Grotesk',system-ui,sans-serif"
          fontWeight={800}
          fontSize={14}
          fill="#0B0E11"
        >
          B
        </text>
      </svg>
      {!compact && (
        <span>
          Built on BNB Smart Chain
          {showChainId && (
            <span className="ml-1 text-[10px] uppercase tracking-wider text-[#22D3EE]">
              · Chain {expected} Testnet
            </span>
          )}
        </span>
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
    </span>
  );
}
