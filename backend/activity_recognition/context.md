# Project Context: Accessible Living Support System with Artificial Intelligence

**Core Objective:**
Develop an AI-driven system to assist elderly individuals in locating misplaced objects within their homes.

**System Modules & Ownership:**

* **Context Builder Module (Owners: Dan & Toan)**
    * *Function:* Captures initial home images to build the baseline database and knowledge graph. This is a one-time initialization step.
    * *Constraint:* You must read and understand this codebase for context, but **strictly do not modify any code related to this module.**

* **Update Module (Owners: Chien & Phat) — CURRENT FOCUS**
    * *Function:* Uses in-house cameras to monitor activities and update the system dynamically.
    * *My Role (Chien):* Person Re-identification. Implementing `torchreid` to re-identify individuals in the video feed and assign names based on a pre-defined gallery.
    * *Phat's Role:* Pose and Object Detection. Determining whether a detected person is currently holding a specific object.
    * *Integration Goal:* Merge the Re-ID pipeline with the pose/object detection pipeline to track object interaction states over time.

* **Web Backend Module (Owner: Chien)**
    * *Function:* Handles video uploads, model inference, and frontend communication.
    * *Current State:* The backend successfully processes the uploaded video and returns the finalized video to the frontend.
    * *New Requirement:* Create a specific backend API endpoint/URL that returns the extracted interaction event data (defined below) after inference. This structured output will be delivered to Phat, who will handle the database update.

**Current Task: Architecture Planning & Integration**

Before writing any integration code, we need to establish a solid technical plan for combining the two components in the Update Module.

* **Target Output:** The integrated system must evaluate the video and output specific interaction events. 
* **Required Event Data:**
    * *Start Hold Event:* `[Person Name, Object Name, Start Time, Fixed Location]`
    * *End Hold Event (Put Down):* `[Person Name, Object Name, End Time, Fixed Location]`
* *Notes on Data:* Time is captured from the video/real-time tracking. Location is fixed and assumed to be pre-defined. 
* *Scope Limitation:* Do not write any code for database insertion. The goal is strictly to return the event data payload.

**Instructions for AI Assistant:**
* Acknowledge this context.
* Propose a system architecture plan to integrate the `torchreid` outputs with the pose/object detection outputs.
* Design the backend endpoint payload structure to return the required event data.
* Restrict all code modifications strictly to Chien and Phat's components.