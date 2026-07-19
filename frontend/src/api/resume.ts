import { api } from "./client";

export async function uploadResume(
    file: File
) {
    const formData = new FormData();

    formData.append("resume", file);
    formData.append("job_description", "Software Engineer"); // Dummy JD for legacy MS1 route

    const response = await api.post(
        "/resume/parse",
        formData
    );

    return response.data;
}