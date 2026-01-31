/**
 * Storage Module
 * Handles all data persistence using window.storage API
 */

const Storage = {
    /**
     * Save a check-in entry
     */
    async saveCheckIn(checkInData) {
        const timestamp = new Date().toISOString();
        const key = `checkin:${timestamp}`;
        
        try {
            const data = {
                ...checkInData,
                timestamp,
                id: timestamp
            };
            
            const result = await window.storage.set(key, JSON.stringify(data), false);
            return result ? data : null;
        } catch (error) {
            console.error('Error saving check-in:', error);
            return null;
        }
    },

    /**
     * Get all check-in entries
     */
    async getAllCheckIns() {
        try {
            const listResult = await window.storage.list('checkin:', false);
            if (!listResult || !listResult.keys) {
                return [];
            }

            const checkIns = [];
            for (const key of listResult.keys) {
                try {
                    const result = await window.storage.get(key, false);
                    if (result && result.value) {
                        checkIns.push(JSON.parse(result.value));
                    }
                } catch (error) {
                    console.error(`Error loading check-in ${key}:`, error);
                }
            }

            // Sort by timestamp, most recent first
            return checkIns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Error getting all check-ins:', error);
            return [];
        }
    },

    /**
     * Get check-ins from the last N days
     */
    async getRecentCheckIns(days = 7) {
        const allCheckIns = await this.getAllCheckIns();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return allCheckIns.filter(checkIn => 
            new Date(checkIn.timestamp) >= cutoffDate
        );
    },

    /**
     * Delete a specific check-in
     */
    async deleteCheckIn(checkInId) {
        const key = `checkin:${checkInId}`;
        try {
            const result = await window.storage.delete(key, false);
            return result ? true : false;
        } catch (error) {
            console.error('Error deleting check-in:', error);
            return false;
        }
    },

    /**
     * Save agent insights
     */
    async saveInsight(insightData) {
        const timestamp = new Date().toISOString();
        const key = `insight:${timestamp}`;
        
        try {
            const data = {
                ...insightData,
                timestamp,
                id: timestamp
            };
            
            const result = await window.storage.set(key, JSON.stringify(data), false);
            return result ? data : null;
        } catch (error) {
            console.error('Error saving insight:', error);
            return null;
        }
    },

    /**
     * Get all insights
     */
    async getAllInsights() {
        try {
            const listResult = await window.storage.list('insight:', false);
            if (!listResult || !listResult.keys) {
                return [];
            }

            const insights = [];
            for (const key of listResult.keys) {
                try {
                    const result = await window.storage.get(key, false);
                    if (result && result.value) {
                        insights.push(JSON.parse(result.value));
                    }
                } catch (error) {
                    console.error(`Error loading insight ${key}:`, error);
                }
            }

            // Sort by timestamp, most recent first
            return insights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Error getting all insights:', error);
            return [];
        }
    },

    /**
     * Save API key to localStorage (not window.storage since it's sensitive)
     */
    saveApiKey(apiKey) {
        try {
            localStorage.setItem('anthropic_api_key', apiKey);
            return true;
        } catch (error) {
            console.error('Error saving API key:', error);
            return false;
        }
    },

    /**
     * Get API key from localStorage
     */
    getApiKey() {
        try {
            return localStorage.getItem('anthropic_api_key') || '';
        } catch (error) {
            console.error('Error getting API key:', error);
            return '';
        }
    },

    /**
     * Clear all data (for reset functionality)
     */
    async clearAllData() {
        try {
            // Clear check-ins
            const checkInsList = await window.storage.list('checkin:', false);
            if (checkInsList && checkInsList.keys) {
                for (const key of checkInsList.keys) {
                    await window.storage.delete(key, false);
                }
            }

            // Clear insights
            const insightsList = await window.storage.list('insight:', false);
            if (insightsList && insightsList.keys) {
                for (const key of insightsList.keys) {
                    await window.storage.delete(key, false);
                }
            }

            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            return false;
        }
    },

    /**
     * Export all data as JSON
     */
    async exportData() {
        try {
            const checkIns = await this.getAllCheckIns();
            const insights = await this.getAllInsights();

            return {
                exportDate: new Date().toISOString(),
                checkIns,
                insights
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    },

    /**
     * Get statistics about check-ins
     */
    async getStatistics() {
        const checkIns = await this.getAllCheckIns();
        
        if (checkIns.length === 0) {
            return null;
        }

        // Calculate various statistics
        const totalCheckIns = checkIns.length;
        const recentCheckIns = await this.getRecentCheckIns(7);
        
        // Calculate average energy level
        const energyLevels = checkIns
            .map(c => c.physical?.energyLevel)
            .filter(e => e !== undefined);
        const avgEnergy = energyLevels.length > 0
            ? energyLevels.reduce((sum, e) => sum + e, 0) / energyLevels.length
            : 0;

        // Calculate average stress level
        const stressLevels = checkIns
            .map(c => c.mental?.stressLevel)
            .filter(s => s !== undefined);
        const avgStress = stressLevels.length > 0
            ? stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length
            : 0;

        // Calculate average sleep quality
        const sleepQualities = checkIns
            .map(c => c.physical?.sleepQuality)
            .filter(s => s !== undefined);
        const avgSleep = sleepQualities.length > 0
            ? sleepQualities.reduce((sum, s) => sum + s, 0) / sleepQualities.length
            : 0;

        return {
            totalCheckIns,
            checkInsLast7Days: recentCheckIns.length,
            averageEnergy: avgEnergy.toFixed(1),
            averageStress: avgStress.toFixed(1),
            averageSleep: avgSleep.toFixed(1),
            oldestCheckIn: checkIns[checkIns.length - 1]?.timestamp,
            newestCheckIn: checkIns[0]?.timestamp
        };
    }
};

// Make Storage available globally
window.WellnessStorage = Storage;
