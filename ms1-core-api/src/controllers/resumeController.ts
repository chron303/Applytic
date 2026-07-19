import { Response } from "express";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { parseResume } from "../services/resumeService";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Controller responsible for handling resume uploads
 * and forwarding them to the MS2 Resume Matching Service.
 */
export async function uploadAndParseResume(
    req: AuthenticatedRequest,
    res: Response
): Promise<void> {

    try {

        const file = req.file;

        const { job_description } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
            return;
        }

        if (!file) {
            res.status(400).json({
                success: false,
                message: "Resume PDF is required."
            });
            return;
        }

        if (!job_description) {
            res.status(400).json({
                success: false,
                message: "job_description is required."
            });
            return;
        }

        let s3Url: string | undefined;

        if (process.env.S3_BUCKET_NAME && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            try {
                const s3Client = new S3Client({
                    region: process.env.AWS_REGION,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    }
                });
                
                const key = `resumes/${userId}-${Date.now()}.pdf`;
                const fileBuffer = await fs.promises.readFile(file.path);
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: key,
                    Body: fileBuffer,
                    ContentType: file.mimetype
                }));

                s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                console.log(`Successfully uploaded resume to S3: ${s3Url}`);
            } catch (s3Error) {
                console.error("Failed to upload resume to S3:", s3Error);
            }
        }

        const profile = await parseResume(
            userId,
            file.path,
            job_description,
            s3Url
        );

        res.status(200).json({
            success: true,
            data: profile
        });

    } catch (error) {

        console.error("Resume Upload Error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Internal Server Error"
        });
    }
}