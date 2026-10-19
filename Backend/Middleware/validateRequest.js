export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            // Parses and strips away unknown properties based on schema (unless .passthrough() is used)
            const validatedBody = schema.parse(req.body);
            req.body = validatedBody;
            next();
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
    };
};
