import { useCallback } from 'react';
import { useUpdatePrices } from '../hooks/useUpdatePrices';
import './UpdatePricesButton.css';

interface UpdatePricesButtonProps {
  onSuccess?: () => void;
}

export default function UpdatePricesButton({ onSuccess }: UpdatePricesButtonProps) {
  const handleSuccess = useCallback(() => { onSuccess?.(); }, [onSuccess]);
  const { updatePrices, updating, updateError } = useUpdatePrices(handleSuccess);

  return (
    <div className="price-update-section">
      <button
        className={`price-update-btn ${updating ? 'is-updating' : ''}`}
        onClick={updatePrices}
        disabled={updating}
        title="Fetch latest prices from CoinGecko (crypto) and open.er-api.com (fiat)"
      >
        {updating ? 'Updating…' : '↻ Update Prices'}
      </button>
      {updateError && (
        <div className="price-update-error" title={updateError}>⚠ {updateError}</div>
      )}
    </div>
  );
}
