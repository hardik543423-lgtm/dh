import { API_URL } from '../config.js';

export const getFundsData = async () => {
    try {
        const activeContextString = localStorage.getItem("activeContext");
        const apiBase = API_URL;
        const token = localStorage.getItem("token");
        let brokerIdVal = null;
        let customerIdVal = null;

        if (activeContextString) {
            try {
                const activeContext = JSON.parse(activeContextString);
                brokerIdVal = activeContext.brokerId;
                customerIdVal = activeContext.customerId;
            } catch (e) {}
        }

        // Fallbacks
        const globalBrokerId = localStorage.getItem('associatedBrokerStringId');
        const userString = localStorage.getItem('loggedInUser');
        const userObject = userString ? JSON.parse(userString) : {};

        let finalCustomerId;
        let finalBrokerId;

        if (userObject.role === 'customer') {
            finalCustomerId = userObject.id;
            finalBrokerId = globalBrokerId;
        } else {
            finalCustomerId = customerIdVal;
            finalBrokerId = brokerIdVal || globalBrokerId;
        }

        if (!finalBrokerId || !finalCustomerId) return null;

        // *** FIX: Ensure NO SPACES in query params ***
        const endpoint = `${apiBase}/api/funds/getFunds?broker_id_str=${finalBrokerId}&customer_id_str=${finalCustomerId}`;

        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`API Error: ${response.status}`);
            return null;
        }

        const result = await response.json();

        if (result.success && result.data) {
            return result.data;
        } else {
            return null;
        }

    } catch (error) {
        console.error("[getFundsData] Error:", error);
        return null;
    }
};
