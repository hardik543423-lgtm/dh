import React, { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";
import "./Funds.css";

// Components
import FundsHeader from "./components/FundsHeader";
import SummaryCards from "./components/SummaryCards";
import ActionButtons from "./components/ActionButtons";
import FundsDetails from "./components/FundsDetails";
import TransactionHistory from "./components/TransactionHistory";
import WithdrawalLimitsCard from "./components/WithdrawalLimitsCard";

import { usePermissions } from "../../contexts/PermissionsContext";

export default function FundsView() {
  const { refreshPermissions } = usePermissions();
  const [fundsData, setFundsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [updating, setUpdating] = useState(false);

  const userString = localStorage.getItem('loggedInUser');
  let userObject = {};
  try { userObject = userString ? JSON.parse(userString) : {}; } catch(e){}
  if (!userObject) userObject = {}; // Protect against "null" string
  const userRole = userObject?.role;

  const activeContextString = localStorage.getItem('activeContext');
  let activeContext = {};
  try { activeContext = activeContextString ? JSON.parse(activeContextString) : {}; } catch(e){}
  if (!activeContext) activeContext = {}; // Protect against "null" string

  // Robust identity logic
  const isBroker = userRole === 'broker';
  const brokerId = isBroker ? (userObject?.id || userObject?._id) : (userObject?.brokerId || activeContext?.brokerId);
  const customerId = isBroker ? (activeContext?.customerId || activeContext?.id) : (userObject?.id || userObject?._id);

  useEffect(() => {
    refreshPermissions();
  }, []);

  console.log("[Funds] Identity Check:", { userRole, brokerId, customerId, activeContext });

  const token = localStorage.getItem("token");
  const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

  const fetchFunds = async () => {
    if (!brokerId || !customerId) {
      console.warn("[Funds] Missing IDs, skipping fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `${apiBase}/api/funds/getFunds?broker_id_str=${brokerId}&customer_id_str=${customerId}`;
      console.log("[Funds] Fetching from:", url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const result = await res.json();
      console.log("[Funds] Fetch Result:", result);
      if (result.success && result.data) {
        setFundsData(result.data);
      }
    } catch (error) {
      console.error('[Funds] Fetch Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brokerId && customerId) fetchFunds();
    else setLoading(false);
  }, [brokerId, customerId]);

  const handleUpdateBalance = async (newBalance) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateNetAvailableBalance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_balance: newBalance })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateIntradayLimit = async (newLimit) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateIntradayAvailableLimit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_limit: newLimit })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateOvernightLimit = async (newLimit) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateOvernightAvailableLimit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_limit: newLimit })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateIntradayAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateIntradayLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateOvernightAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateOvernightLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateWithdrawalLimits = async (min, max) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateWithdrawalLimits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, min, max })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateOptionPercentage = async (newPercent) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateOptionLimitPercentage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, percentage: newPercent })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateOptionLimitsAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateOptionLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxPercentage = async (newPercent) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxLimitPercentage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, percentage: newPercent })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const handleUpdateMcxLimitsAll = async (available, free, used) => {
    setUpdating(true);
    try {
      await fetch(`${apiBase}/api/funds/updateMcxLimitsAll`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, available_limit: available, free_limit: free, used_limit: used })
      });
      await fetchFunds();
    } catch (error) { console.error(error); } finally { setUpdating(false); }
  };

  const SkeletonLoader = () => (
    <div className="funds-container">
      <div className="section-header px-1">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" style={{ width: '80%' }} />
        <div className="mt-5 flex gap-2">
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-badge" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="skeleton skeleton-button" />
        <div className="skeleton skeleton-button" />
      </div>

      <div className="skeleton skeleton-card" style={{ height: '140px' }} />
      <div className="skeleton skeleton-card" style={{ height: '140px' }} />
      <div className="skeleton skeleton-card" style={{ height: '160px', background: 'var(--funds-accent)', opacity: 0.2 }} />

      <div className="skeleton skeleton-card" style={{ height: '300px' }} />
    </div>
  );

  if (loading) return <SkeletonLoader />;

  return (
    <div className="funds-container">
      <div className="funds-content-wrapper">
        <FundsHeader
          customerId={customerId}
          brokerPhone={fundsData?.broker_mobile_number || "Not Set"}
          isBroker={userRole === 'broker'}
          onUpdatePhone={async (val) => {
            await fetch(`${apiBase}/api/funds/updateBrokerMobile`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, mobile: val })
            });
            fetchFunds();
          }}
        />

        <ActionButtons />

        <SummaryCards
          depositedCash={fundsData?.net_available_balance || 0}
          depositMargin={fundsData?.net_pnl || 0}
          totalMargin={fundsData?.intraday?.available_limit || 0}
          isBroker={isBroker}
          onUpdateBalance={handleUpdateBalance}
          onUpdateIntradayTotal={handleUpdateIntradayLimit} // Top card
          onUpdateMargin={async (newMargin) => {
            await fetch(`${apiBase}/api/funds/updateNetPnl`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ broker_id_str: brokerId, customer_id_str: customerId, new_pnl: newMargin })
            });
            fetchFunds();
          }}
        />

        <FundsDetails
          intradayMargin={fundsData?.intraday?.available_limit || 0}
          intradayUsed={fundsData?.intraday?.used_limit || 0}
          intradayFreeLimit={fundsData?.intraday?.free_limit}
          deliveryMargin={fundsData?.overnight?.available_limit || 0}
          deliveryUsed={fundsData?.overnight?.used_limit || 0}
          deliveryFreeLimit={fundsData?.overnight?.free_limit}
          optionUsed={(fundsData?.option_limit?.intraday?.used_today || 0) + (fundsData?.option_limit?.overnight?.used_today || 0)}
          optionTotal={((fundsData?.intraday?.available_limit || 0) + (fundsData?.overnight?.available_limit || 0)) * (fundsData?.option_limit_percentage || 10) / 100}
          optionAvailableLimit={fundsData?.option_limit?.available_limit}
          optionFreeLimit={fundsData?.option_limit?.free_limit}
          optionUsedLimit={fundsData?.option_limit?.used_limit}
          optionPercentage={fundsData?.option_limit_percentage || 10}
          mcxUsed={(fundsData?.mcx_limit?.intraday?.used_today || 0) + (fundsData?.mcx_limit?.overnight?.used_today || 0)}
          mcxTotal={((fundsData?.intraday?.available_limit || 0) + (fundsData?.overnight?.available_limit || 0)) * (fundsData?.mcx_limit_percentage || 10) / 100}
          mcxAvailableLimit={fundsData?.mcx_limit?.available_limit}
          mcxFreeLimit={fundsData?.mcx_limit?.free_limit}
          mcxUsedLimit={fundsData?.mcx_limit?.used_limit}
          mcxPercentage={fundsData?.mcx_limit_percentage || 10}
          realizedPnl={fundsData?.net_pnl || 0}
          isBroker={isBroker}
          onUpdateIntradayAll={handleUpdateIntradayAll}
          onUpdateOvernightAll={handleUpdateOvernightAll}
          onUpdateOptionAll={handleUpdateOptionLimitsAll}
          onUpdateOptionPercentage={handleUpdateOptionPercentage}
          onUpdateMcxAll={handleUpdateMcxLimitsAll}
          onUpdateMcxPercentage={handleUpdateMcxPercentage}
        />

        {/* Withdrawal Limits - Broker Only */}
        {isBroker && (
          <div className="mt-4">
            <WithdrawalLimitsCard
              minLimit={fundsData?.withdrawal_limits?.min || 0}
              maxLimit={fundsData?.withdrawal_limits?.max || 0}
              onSave={handleUpdateWithdrawalLimits}
            />
          </div>
        )}

        {/* Transaction History - Placed below Margin Details as requested */}
        <div className="mt-8">
          <TransactionHistory
            brokerId={brokerId}
            customerId={customerId}
            token={token}
            apiBase={apiBase}
          />
        </div>
      </div>
    </div>
  );
}