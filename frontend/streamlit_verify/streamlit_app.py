import requests
import streamlit as st


st.set_page_config(page_title="ALISS ReID Video Tester", layout="centered")
st.title("ALISS Person Re-Identification (Backend Verification)")


BACKEND_BASE_URL = st.text_input("Backend URL", value="http://127.0.0.1:8000")

uploaded_file = st.file_uploader("Upload a video file", type=["mp4", "mov", "avi", "mkv"])

if uploaded_file is not None:
    st.write(f"Selected: `{uploaded_file.name}` ({uploaded_file.size} bytes)")


if st.button("Process video", disabled=(uploaded_file is None)):
    if uploaded_file is None:
        st.stop()

    with st.spinner("Uploading + processing on backend..."):
        try:
            resp = requests.post(
                f"{BACKEND_BASE_URL}/process-video",
                files={
                    "file": (
                        uploaded_file.name,
                        uploaded_file.getvalue(),
                        uploaded_file.type or "video/mp4",
                    )
                },
                timeout=60 * 60,
            )
        except Exception as e:
            st.error(f"Request failed: {e}")
            st.stop()

        if resp.status_code != 200:
            st.error(f"Backend error: {resp.status_code} - {resp.text}")
            st.stop()

        job_id = resp.json().get("job_id")
        if not job_id:
            st.error("No `job_id` returned by backend.")
            st.stop()

    st.success(f"Job created: {job_id}")

    with st.spinner("Downloading results..."):
        meta_resp = requests.get(f"{BACKEND_BASE_URL}/results/{job_id}/meta", timeout=60)
        if meta_resp.status_code == 200:
            st.subheader("Track assignment summary")
            st.json(meta_resp.json())
        else:
            st.warning(f"Could not fetch meta: {meta_resp.status_code}")

        video_resp = requests.get(f"{BACKEND_BASE_URL}/results/{job_id}/video", timeout=60 * 10)
        if video_resp.status_code == 200:
            st.subheader("Annotated output video")
            st.video(video_resp.content)
        else:
            st.error(f"Could not fetch video: {video_resp.status_code} - {video_resp.text}")

