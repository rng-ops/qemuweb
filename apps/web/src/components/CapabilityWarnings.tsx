import type { RuntimeCapabilities } from '@qemuweb/runtime';
import { checkMinimumRequirements } from '@qemuweb/runtime';

interface CapabilityWarningsProps {
  capabilities: RuntimeCapabilities | null;
}

export function CapabilityWarnings({ capabilities }: CapabilityWarningsProps) {
  if (!capabilities) return null;

  const { satisfied, missing, warnings } = checkMinimumRequirements(capabilities);

  if (satisfied && warnings.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* Critical errors */}
      {missing.length > 0 && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Critical Requirements Missing
          </h3>
          <ul className="text-red-200 text-sm space-y-1">
            {missing.map((msg, i) => (
              <li key={i}>• {msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <h3 className="text-yellow-400 font-semibold flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Performance Warnings
          </h3>
          <ul className="text-yellow-200 text-sm space-y-1">
            {warnings.map((msg, i) => (
              <li key={i}>• {msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
