import { hashPassword, comparePasswords } from "../helper/passwordHashing.js";

import UserModel from "../models/user.model.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import verificationEmailTemplate from "../utils/verificationEmailTemplate.js";
import dotenv from "dotenv";


import jwt from "jsonwebtoken";

dotenv.config();

//register user
export const registerUserController = async (req, res) => {
    try {
        const { name, email, password, mobile } = req.body;

        if (!name || !email || !password || !mobile) {
            return res.status(400).json({
                message: "Please fill the required fields",
                error: true,
                success: false
            })
        }

        const existingUser = await UserModel.findOne({ $or: [{ email }, { mobile }] })

        if (existingUser) {
            return res.status(400).json({
                message: existingUser.email === email
                    ? "Email is already registered"
                    : "Mobile number is already registered",
                error: true,
                success: false
            })
        }

        const hashedPassword = await hashPassword(password);

        const newUser = new UserModel({
            name,
            email,
            password: hashPassword,
            mobile
        })

        const savedUser = await newUser.save();

        const verifyEmailURL = `${process.env.CLIENT_URL}/verify-email?code=${savedUser._id}`;

        await sendEmail({
            sendTo: email,
            subject: "Verification Email from Blinkit",
            html: verificationEmailTemplate({
                name: savedUser.name,
                url: verifyEmailURL
            })
        })

        const accessToken = await generateAccessToken(savedUser._id);
        const refreshToken = await generateRefreshToken(savedUser._id);

        const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: None
        }

        res.cookie("accessToken", accessToken, cookiesOption);
        res.cookie("redreshToken", refreshToken, cookiesOption);

        return res.status(201).json({
            message: "User registered successfully and logged in.",
            error: false,
            success: true,
            data: {
                user: savedUser,
                accessToken,
                refreshToken
            }
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error.",
            error: true,
            success: false
        })
    }
}

//verify user
export const verifyUserController = async (req, res) => {
    try {
        const { code } = req.body;

        const user = await UserModel.findOneAndUpdate(
            { _id: code },
            { $set: { verify_email: true } },
        );

        if (!user) {
            return res.status(400).json({
                message: "Invalid Code",
                error: true,
                success: false
            })
        }

        return res.stasus(200).json({
            message: "Email verified successfully",
            error: false,
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            mesasge: error.message || error,
            error: true,
            success: false
        })
    }
}


//login user
export const loginUserController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.staus(400).json({
                message: "Email and password are required",
                error: true,
                success: false
            })
        }

        const user = await UserModel.findOne({ email })

        if (!user) {
            return res.status(400).json({
                message: "User not registering with this email!",
                error: true,
                success: false
            })
        }

        if (user.status !== "Active") {
            return res.status(400).json({
                message: `Yout account is ${user.status}, Pleace contact to admin`,
                error: true,
                success: false
            })
        }

        const isPasswordMatch = await comparePasswords(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                message: "Invalid credentials! Please check your email or password",
                error: true,
                success: false,
            })
        }

        const accessToken = await generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        const updateUser = await UserModel.findByIdAndUpdate(user?._id, {
            last_login_date: new Date();
        })

        const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        }

        res.cookie('accessToken', accessToken, cookiesOption);
        res.cookie('refreshToken', refreshToken, cookiesOption);

        return res.status(200).json({
            message: "Login successfully",
            error: false,
            success: true,
            data: {
                accessToken,
                refreshToken
            }
        })

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//Logout user
export const logoutController = async (req, res) => {
    try {
        const userId = req.userId

        const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        }

        res.clearCookie("accessToken", cookiesOption);
        res.clearCookie("refreshToken", cookiesOption);

        const removeRefreshToken = await UserModel.findByIdAndUpdate(userId,
            {
                refresh_token: ""
            })

        return res.status(200).json({
            message: "Logged out successfully",
            error: false,
            success: true
        })
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

//refresh token

export const refreshTokenController = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req?.header?.authorization?.split(" ")[1]


        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh Token not found!",
                error: true,
                success: false
            })
        }

        const verifyToken = await jwt.verify(refreshToken, process.env.SECRET_KEY_REFRESH_TOKEN)

        if (!verifyToken) {
            return res.stauts(400).json({
                message: "Token is expired!",
                error: true,
                success: false
            })
        }

        const iserId = verifyToken._id;
        const newAccessToken = await generateAccessToken(iserId);

        const cookiesOption = {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        }
        res.cookie("accessToken", newAccessToken, cookiesOption);

        return res.status(200).json({
            message: "New accessToken generated",
            error: false,
            success: true,
            data: {
                accessToken: newAccessToken
            }
        })

    } catch (error) {
        return res.status(200).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}