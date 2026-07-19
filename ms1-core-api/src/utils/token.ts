import crypto from "crypto";

export function generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function getVerificationExpiry(): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
}