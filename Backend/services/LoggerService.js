import { getAdminIO } from '../sockets/io.js';

class LoggerService {
    constructor() {
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        this.isLogging = false;
    }

    init() {
        this.originalConsole.log('[LoggerService] Initializing live log interceptor...');
        
        const levels = ['log', 'error', 'warn', 'info'];
        
        levels.forEach(level => {
            console[level] = (...args) => {
                // Call original console method first
                this.originalConsole[level].apply(console, args);
                
                // Prevent infinite recursion if socket emission logs something
                if (this.isLogging) return;
                
                try {
                    this.isLogging = true;
                    const adminIO = getAdminIO();
                    
                    if (adminIO) {
                        const message = args.map(arg => {
                            if (arg instanceof Error) return arg.stack || arg.message;
                            if (typeof arg === 'object') {
                                try {
                                    return JSON.stringify(arg);
                                } catch (e) {
                                    return '[Circular Object]';
                                }
                            }
                            return String(arg);
                        }).join(' ');
                        
                        // Emit to the entire namespace directly for maximum reliability
                        adminIO.emit('log_update', {
                            timestamp: new Date().toISOString(),
                            level: level === 'log' ? 'info' : level,
                            message: message.substring(0, 10000)
                        });
                    }
                } catch (err) {
                    this.originalConsole.error('[LoggerService] Failed to emit log:', err.message);
                } finally {
                    this.isLogging = false;
                }
            };
        });
    }

    // Direct logging methods if we want to bypass console
    emitCustomLog(level, message, data = null) {
        const adminIO = getAdminIO();
        if (adminIO) {
            adminIO.to('admin_logs').emit('log_update', {
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            });
        }
    }
}

const loggerInstance = new LoggerService();
export default loggerInstance;
