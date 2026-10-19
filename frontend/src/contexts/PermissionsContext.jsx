import React, { createContext, useContext, useState, useEffect } from 'react';

const PermissionsContext = createContext();

export const usePermissions = () => useContext(PermissionsContext);

export const PermissionsProvider = ({ children }) => {
    const [lockedFeatures, setLockedFeatures] = useState({});
    const [loading, setLoading] = useState(true);

    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    const fetchPermissions = async () => {
        const userString = localStorage.getItem('loggedInUser');
        const userObject = userString ? JSON.parse(userString) : null;
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const activeContext = JSON.parse(localStorage.getItem('activeContext') || '{}');

        if (!userObject || !token) {
            setLoading(false);
            return;
        }

        const isBroker = userObject.role === 'broker';
        
        // Identity logic: 
        // 1. Get Customer ID
        const targetCustomerId = isBroker ? (activeContext.customerId || activeContext.id) : (userObject.id || userObject._id);
        
        // 2. Get Broker ID
        const targetBrokerId = isBroker ? (userObject.id || userObject._id) : (userObject.brokerId || activeContext.brokerId);

        if (!targetCustomerId || !targetBrokerId) {
            console.warn("[Permissions] Missing IDs. Customer:", targetCustomerId, "Broker:", targetBrokerId);
            setLoading(false);
            return;
        }

        try {
            const url = `${apiBase}/api/permissions/get?broker_id_str=${String(targetBrokerId)}&customer_id_str=${String(targetCustomerId)}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success) {
                const features = result.data.locked_features || {};
                console.log(`[Permissions] Loaded for ${targetCustomerId}:`, features);
                setLockedFeatures(features);
            } else {
                setLockedFeatures({});
            }
        } catch (error) {
            console.error("Permissions Fetch Error:", error);
            setLockedFeatures({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
        
        const handleUpdate = () => {
            fetchPermissions();
        };
        
        window.addEventListener('permissions:updated', handleUpdate);
        
        // Also listen for a generic "context:changed" if other components emit it
        window.addEventListener('context:changed', handleUpdate);

        // Polling as a fallback (every 10 seconds)
        const interval = setInterval(fetchPermissions, 10000);

        return () => {
            window.removeEventListener('permissions:updated', handleUpdate);
            window.removeEventListener('context:changed', handleUpdate);
            clearInterval(interval);
        };
    }, []);

    const isLocked = (featureId) => {
        const userString = localStorage.getItem('loggedInUser');
        const userObject = userString ? JSON.parse(userString) : null;
        if (userObject && userObject.role === 'broker') {
            return false; // Brokers are NEVER locked/restricted!
        }
        return !!lockedFeatures[featureId];
    };

    return (
        <PermissionsContext.Provider value={{ lockedFeatures, isLocked, loading, refreshPermissions: fetchPermissions }}>
            {children}
        </PermissionsContext.Provider>
    );
};
