"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const formatZodError = (error) => error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
}));
const validateBody = (schema) => {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request body',
                details: formatZodError(parsed.error),
            });
        }
        req.body = parsed.data;
        return next();
    };
};
exports.validateBody = validateBody;
