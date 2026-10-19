import mongoose from 'mongoose';
const { Schema } = mongoose;

// Helper function to generate a unique 10-digit ID for login
function generateId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const BrokerSchema = new Schema({
    // 🔑 PRIMARY LOGIN IDENTIFIER: Ab 'login_id' hai
    login_id: {
        type: String,
        required: true,
        unique: true,
        default: generateId, // ID will be auto-generated upon creation
    },
    
    password: {
        type: String,
        required: true,
    },
    
    name: {
        type: String,
        required: true,
    },

    organization_name: {
        type: String, 
        required: true,
    },
    
    // Broker/Admin role
    role: {
        type: String,
        enum: ['broker', 'admin'],
        default: 'broker',
    },

    created_at: {
        type: Date,
        default: Date.now,
    },
    default_jobbing_price: {
        type: Number,
        default: 0.08
    },
    default_jobbing_type: {
        type: String,
        default: 'percentage'
    },
    is_banned: {
        type: Boolean,
        default: false
    },
    can_create_customer: {
        type: Boolean,
        default: true
    }
});

    const BrokerModel = mongoose.model('Broker', BrokerSchema);
    export default BrokerModel;