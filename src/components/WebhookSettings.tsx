'use client';

import { useEffect, useState } from 'react';

interface WebhookSubscription {
  id: number;
  callback_url: string;
  created_at: string;
}

interface SubscriptionStatus {
  strava: WebhookSubscription[];
  database: any[];
}

export default function WebhookSettings() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/webhooks/subscribe');

      if (!response.ok) {
        throw new Error('Failed to fetch webhook subscriptions');
      }

      const data = await response.json();
      setSubscriptions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async () => {
    try {
      setCreating(true);
      setError(null);

      // Get the callback URL (current domain + webhook endpoint)
      const callbackUrl = `${window.location.origin}/api/webhooks/strava`;

      const response = await fetch('/api/webhooks/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callbackUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create webhook subscription');
      }

      await fetchSubscriptions();
      alert('Webhook subscription created successfully! New runs will now be processed automatically.');
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteSubscription = async (subscriptionId: number) => {
    if (!confirm('Are you sure you want to delete this webhook subscription? New runs will no longer be processed automatically.')) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/webhooks/subscribe?id=${subscriptionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete webhook subscription');
      }

      await fetchSubscriptions();
      alert('Webhook subscription deleted successfully.');
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">Webhook Settings</h2>
        <p className="text-gray-300">Loading webhook status...</p>
      </div>
    );
  }

  const hasActiveSubscription = subscriptions && subscriptions.strava.length > 0;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-4">Webhook Settings</h2>

      <div className="mb-6">
        <p className="text-gray-300 mb-2">
          Enable webhook integration to automatically process and map songs whenever you upload a new run from your watch.
        </p>
        <p className="text-gray-400 text-sm">
          When enabled, your runs will be pre-processed and ready to view immediately without needing to click "Map Music".
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {/* Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Status:</span>
          <span className={`font-semibold ${hasActiveSubscription ? 'text-green-400' : 'text-gray-400'}`}>
            {hasActiveSubscription ? '✓ Active' : '○ Inactive'}
          </span>
        </div>

        {hasActiveSubscription && subscriptions.strava.map((sub) => (
          <div key={sub.id} className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-gray-400 mb-1">Subscription ID:</div>
                <div className="text-white font-mono text-sm mb-3">{sub.id}</div>

                <div className="text-sm text-gray-400 mb-1">Callback URL:</div>
                <div className="text-white font-mono text-xs mb-3 break-all">{sub.callback_url}</div>

                <div className="text-sm text-gray-400 mb-1">Created:</div>
                <div className="text-white text-sm">
                  {new Date(sub.created_at).toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => deleteSubscription(sub.id)}
                disabled={deleting}
                className="ml-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!hasActiveSubscription && (
        <button
          onClick={createSubscription}
          disabled={creating}
          className="w-full bg-spotify-green hover:bg-spotify-green/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {creating ? 'Creating...' : 'Enable Automatic Processing'}
        </button>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h3 className="text-blue-300 font-semibold mb-2">How it works:</h3>
        <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
          <li>Upload a run from your watch to Strava</li>
          <li>Strava sends a notification to our webhook</li>
          <li>We automatically fetch the run and map your Spotify songs</li>
          <li>Your run is ready to view with all songs mapped!</li>
        </ol>
      </div>
    </div>
  );
}
