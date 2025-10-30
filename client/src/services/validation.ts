import { NextFunction, Request, Response } from 'express';
import z, { ZodError } from "zod";

export const validateActiveNodes = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.error("Active nodes query validation error:", error.issues);
                return res.status(400).json({
                    error: "Invalid query parameters",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
             console.error("Internal server error during active nodes validation:", error);
            return res.status(500).json({ error: "Internal server error", status: 500 });
        }
    };

export const validateSubscription = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.error("Subscription validation error:", error.issues);
                return res.status(400).json({
                    error: "Validation error",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
            console.error("Internal server error during subscription validation:", error);
            return res.status(500).json({ error: "Internal server error", status: 500 });
        }
    };


export const validateStartSession = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.log("start-session endpoint validation error: 400, ", error.issues);
                return res.status(400).json({
                    error: "start-session endpoint validation error",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
            console.log("start-session endpoint internal server error: 500");
            return res.status(500).json({ error: "Internal server error" });
        }
    };

export const validateCloseSession = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.log("close-session endpoint validation error: 400, ", error.issues);
                return res.status(400).json({
                    error: "Validation error",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
            console.log("close-session endpoint internal server error: 500");
            return res.status(500).json({ error: "Internal server error" });
        }
    };

export const validateSendMessage = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.log("send-message endpoint validation error: 400, ", error.issues);
                return res.status(400).json({
                    error: "Validation error",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
            console.log("send-message endpoint internal server error: 500");
            return res.status(500).json({ error: "Internal server error" });
        }
    };

export const validateDownloadFile = <T extends z.ZodTypeAny>(schema: T) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                console.log("download-file endpoint validation error: 400, ", error.issues);
                return res.status(400).json({
                    error: "Validation error",
                    details: error.issues.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                    })),
                    status: 400
                });
            }
            console.log("download-file endpoint internal server error: 500");
            return res.status(500).json({ error: "Internal server error" });
        }
    };