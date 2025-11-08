import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema(
    {
        accessToken: { type: String },
        refreshToken: { type: String },
        scope: { type: String },
        tokenType: { type: String },
        expiryDate: { type: Date },
        idToken: { type: String },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, index: true },
        name: { type: String },
        picture: { type: String },
        locale: { type: String },
        tokens: tokenSchema,
        lastLoginAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;

