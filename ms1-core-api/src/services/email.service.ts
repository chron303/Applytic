import {
    SendEmailCommand,
} from "@aws-sdk/client-ses";

import { sesClient } from "../config/aws";

export async function sendEmail(
    to: string,
    subject: string,
    html: string
) {
    const command = new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL!,
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Subject: {
                Data: subject,
            },
            Body: {
                Html: {
                    Data: html,
                },
            },
        },
    });

    return await sesClient.send(command);
}