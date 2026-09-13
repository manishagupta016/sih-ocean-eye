I want you to modify my EXISTING Ocean Eye / SIH PS 26057 dashboard, not create a new dashboard from scratch.

FIRST:
1. Inspect the entire existing project structure and the current dashboard implementation.
2. Understand how the existing HTML, CSS, JavaScript, Plotly visualizations, filters, data, 3D model viewer, geospatial section, and navigation work.
3. Preserve all existing working functionality.
4. Do NOT remove or replace existing features unless absolutely necessary.
5. Make the implementation production-quality and demo-ready for a Smart India Hackathon presentation.

MAIN GOAL:

Upgrade the existing dashboard into a professional "Underwater Side-Scan Sonar Marine Object Intelligence & Identification System".

The dashboard should clearly demonstrate this workflow:

SIDE-SCAN SONAR INPUT
        ↓
SONAR FEATURE EXTRACTION
        ↓
OBJECT / DEBRIS IDENTIFICATION
        ↓
MORPHOLOGICAL ANALYSIS
        ↓
3D UNDERWATER RECONSTRUCTION
        ↓
GEOLOCATION + DEPTH
        ↓
CONFIDENCE / DETECTION DIFFICULTY
        ↓
DECISION SUPPORT

IMPORTANT:
The interface must make it obvious that the system is designed for underwater side-scan sonar object identification.

==================================================
1. KEEP THE EXISTING DASHBOARD
==================================================

Do NOT rebuild the entire application.

Keep:
- Existing dark premium ocean/command-center design
- Existing navigation tabs
- Existing global filters
- Existing Overview
- Existing Geospatial
- Existing 3D Models
- Existing Acoustic
- Existing Geometry
- Existing Seabed & Texture
- Existing Detection
- Existing Class Intelligence
- Existing All Parameters
- Existing Correlation
- Existing Data Explorer
- Existing Plotly visualizations
- Existing synthetic dataset
- Existing NOAA real-reference information
- Existing 3D viewer functionality

Only improve and extend the current implementation.

==================================================
2. IMPROVE THE 3D MODELS / OBJECT IDENTIFICATION SECTION
==================================================

The existing dashboard already has a "Side Scan Sonar → Visual Underwater Reconstruction" section.

Upgrade it into the strongest section of the application.

For every class, show:

A. Side-scan sonar interpretation
B. 3D underwater reconstruction
C. Object identification information
D. Morphological characteristics
E. Sonar characteristics
F. Geometric measurements
G. Detection indicators
H. Geolocation
I. Confidence
J. Detection difficulty

The existing 12 classes are:

1. Plane
2. Ship
3. Pipe
4. Mine
5. Tire
6. Mound
7. Platform
8. Mannequin
9. Sea Grass
10. Mud
11. Rock
12. Ghost Net

Do not rename these classes unless the existing data requires it.

==================================================
3. ADD A PROFESSIONAL OBJECT IDENTIFICATION CARD
==================================================

When a user selects/clicks an object, show a detailed identification panel.

Example structure:

OBJECT IDENTIFICATION
---------------------
Class: Ship
Category: Shipwreck
Detection Confidence: 92%
Detection Difficulty: Medium
Visibility Score: 0.81

SONAR SIGNATURE
---------------
Target Backscatter
Target Contrast
Shadow Length
Shadow Width
Shadow/Target Ratio
Background Backscatter
Sonar Frequency
Pixel Resolution
Insonification Angle

MORPHOLOGY
----------
Length
Width
Height
Aspect Ratio
Relief
Orientation
Surface Roughness
Edge Regularity
Fragmentation

ENVIRONMENT
-----------
Water Depth
Seabed Type
Burial %
Towfish Altitude
Slant Range

GEOLOCATION
-----------
Latitude
Longitude
Water Depth

INTERPRETATION CUES
-------------------
Display the existing class-specific underwater visual cues/morphology already defined in the code.

Use the actual selected record's values wherever possible.

Do NOT invent fake measurements when an existing dataset value is available.

==================================================
4. MAKE THE SONAR → OBJECT IDENTIFICATION RELATIONSHIP CLEAR
==================================================

This is extremely important.

The user should visually understand WHY the system identifies an object.

For example:

SONAR EVIDENCE
• elongated high-backscatter target
• strong acoustic shadow
• regular hull-like geometry
• high relief
• consistent dimensions

        ↓

IDENTIFIED OBJECT

SHIP

        ↓

CONFIDENCE

92%

Create a visual "Identification Evidence" panel.

Use dynamic values from the selected record.

Do not claim that the dashboard is performing real ML inference if the current dashboard is using synthetic/demo data.

Clearly distinguish:

REAL DATA
SYNTHETIC DATA
MODEL/DEMO RECONSTRUCTION

==================================================
5. ADD SONAR SIGNATURE VISUALIZATION
==================================================

For the selected object, add a compact sonar-signature visualization showing:

- target backscatter
- background backscatter
- target contrast
- shadow length
- shadow width
- shadow-target ratio
- range/slant geometry

Prefer an intuitive Plotly chart, gauge, bar chart, or radar-style visualization.

The visualization should answer:

"What acoustic characteristics make this object identifiable?"

==================================================
6. ADD MORPHOLOGY / SHAPE ANALYSIS
==================================================

For every class, dynamically display the relevant morphology.

Examples:

Plane:
- wingspan
- fuselage dimensions
- elongated/flat wreck structure
- shadow characteristics

Ship:
- hull width
- length
- superstructure/high relief
- shadow characteristics

Pipe:
- pipe diameter
- length
- cylindrical geometry

Mine:
- circular/spherical geometry
- diameter
- radial structure
- strong shadow

Tire:
- outer diameter
- inner diameter
- ring geometry

Mound:
- footprint
- relief
- irregularity

Platform:
- footprint
- support count
- repeated structural geometry

Mannequin:
- body length
- human-like silhouette
- limb separation

Sea Grass:
- vegetation patch area
- vegetation height
- texture/patch continuity

Mud:
- low relief
- weak return
- smooth texture

Rock:
- roundness
- irregular shape
- hard return
- shadow

Ghost Net:
- mesh size
- twine diameter
- net area
- tangled/flexible geometry

Use the existing MORPH3D / CUES3D information already present in the application where available.

==================================================
7. CREATE A "WHY THIS CLASS?" PANEL
==================================================

Add a panel titled:

"WHY THIS OBJECT WAS IDENTIFIED"

It should dynamically list the strongest available characteristics for the selected class/record.

Example:

WHY THIS CLASS?
✓ High target contrast
✓ Strong acoustic shadow
✓ Elongated geometry
✓ High relief
✓ Consistent hull-like dimensions
✓ Low burial

Then show:

PRIMARY IDENTIFICATION CUES
1. Strong acoustic shadow
2. Elongated target geometry
3. High-relief structure

Make this visually impressive but technically honest.

If these are rule-based/demo interpretation cues rather than actual ML explanations, label them appropriately.

==================================================
8. ADD A CLEAR CONFIDENCE / RISK AREA
==================================================

Create a visual section:

IDENTIFICATION STATUS

Class: SHIP
Confidence: 92%
Visibility: High
Detection Difficulty: Medium
Burial: 8%
Target Contrast: +X dB

Use clear visual indicators.

Also include:

"Confidence is based on the selected dataset record / demonstration values."

Do not falsely represent synthetic label confidence as a real-world validated model accuracy.

==================================================
9. IMPROVE THE 3D VIEWER
==================================================

Keep the existing 3D viewer.

Improve it with:

- Isometric
- Front
- Top
- Side
- Auto rotate
- Seabed toggle
- Acoustic shadow toggle
- Suspended particles toggle
- Measurement axes toggle

These controls already exist; preserve them.

Add, if technically safe:

- object dimension annotations
- length/width/height measurement indicators
- target orientation indicator
- water-depth indicator
- sonar direction / illumination direction
- object bounding footprint
- hover information

Do not make the visualization misleading.

==================================================
10. ADD "SONAR PARAMETERS" AND "OBJECT PARAMETERS"
==================================================

Organize the current large parameter list into meaningful groups.

Instead of presenting everything as one long list, group parameters as:

A. GEOLOCATION
- Latitude
- Longitude
- Water Depth

B. SONAR ACQUISITION
- Sonar Frequency
- Range Scale
- Towfish Altitude
- Slant Range
- Pixel Resolution
- Track Heading
- Cross Track
- Insonification Angle

C. ACOUSTIC RESPONSE
- Background Backscatter
- Target Backscatter
- Target Contrast

D. OBJECT GEOMETRY
- Length
- Width
- Height
- Aspect Ratio
- Relief
- Orientation

E. ACOUSTIC SHADOW
- Shadow Length
- Shadow Width
- Shadow/Target Ratio

F. SEABED / SURFACE
- Burial
- Surface Roughness
- Texture Variance
- Edge Regularity
- Fragmentation

G. DETECTION
- Object Count
- Visibility
- Detection Difficulty
- Label Confidence

H. CLASS-SPECIFIC PARAMETERS
- Wing Span
- Fuselage Diameter
- Hull Width
- Pipe Diameter
- Tire dimensions
- Mesh Size
- Twine Diameter
- Net Area
- Rock Roundness
- Mound Footprint
- Vegetation Area
- Vegetation Height
- Support Count
- Platform Footprint
- Body Length

==================================================
11. ADD A "SONAR INTERPRETATION PIPELINE" VISUAL
==================================================

At the top of the 3D/object-identification page, add a compact horizontal pipeline:

SONAR IMAGE
→
SIGNAL / BACKSCATTER
→
SHADOW ANALYSIS
→
GEOMETRY
→
MORPHOLOGY
→
CLASSIFICATION
→
3D RECONSTRUCTION
→
GEOLOCATION

Make it visually polished.

==================================================
12. MAKE THE 12 CLASS GALLERY MORE INFORMATIVE
==================================================

Keep the existing gallery.

Each card should show:

[Class number]
[Class name]

SIDE-SCAN SONAR
[sonar interpretation]

3D RECONSTRUCTION
[3D model]

Then:

Category
Key morphology
Key sonar cue
Detection difficulty
Typical visual signature

Add a "View detailed analysis" interaction.

==================================================
13. ADD A COMPARISON MODE
==================================================

If practical, add a feature allowing the user to compare two classes.

Example:

SHIP vs PLANE

Compare:

- Length
- Width
- Height
- Aspect Ratio
- Relief
- Shadow Length
- Target Contrast
- Visibility
- Detection Difficulty
- Sonar characteristics

This would be highly useful for demonstrating how the system differentiates visually similar underwater targets.

==================================================
14. MAKE THE DASHBOARD JUDGING-FRIENDLY
==================================================

This is for SIH PS 26057.

A judge should understand the project within 30–60 seconds.

The first screen of the dashboard should immediately communicate:

"AI-Assisted Underwater Side-Scan Sonar Object Identification"

Then show:

12 OBJECT CLASSES
2,400 SYNTHETIC RECORDS
SONAR ANALYSIS
3D RECONSTRUCTION
GEOLOCATION
DETECTION CONFIDENCE

Keep the existing disclaimer that synthetic data is synthetic and real NOAA reference coordinates are real.

Do not mix synthetic ML coordinates with real NOAA coordinates.

==================================================
15. IMPORTANT DATA INTEGRITY RULES
==================================================

Do NOT fabricate real-world detection results.

Do NOT claim:
- real-time sonar detection
- validated AI accuracy
- operational underwater surveillance
- real ML inference

unless the existing application actually implements it.

Use wording such as:

"Dataset-driven reconstruction"
"Demonstration inference"
"Synthetic dataset"
"Sonar-inspired visualization"
"Prototype decision-support interface"

where appropriate.

Keep the existing distinction between REAL and SYNTHETIC data.

==================================================
16. UI / UX DESIGN
==================================================

Maintain the existing premium dark ocean command-center theme.

Make it feel like a professional:

NAVAL / MARITIME
+
AI / COMPUTER VISION
+
SONAR ANALYTICS
+
GEOSPATIAL INTELLIGENCE

Use:

- clear hierarchy
- compact cards
- cyan/purple/green accents already used in the dashboard
- readable typography
- professional Plotly charts
- subtle animations
- responsive layout
- no excessive decoration

Avoid making it look like a generic admin dashboard.

==================================================
17. TECHNICAL REQUIREMENTS
==================================================

Before modifying anything:

- inspect existing code
- identify existing functions
- identify DATA structure
- identify CLASSES
- identify LABELS
- identify NUMERIC fields
- identify 3D model generation functions
- identify current navigation
- identify current filter logic

Reuse existing functions and data structures whenever possible.

Do not duplicate large sections of code.

Do not introduce unnecessary libraries.

Do not break Plotly.

Do not break the existing filters.

Do not break the existing 3D modal.

Do not break geospatial visualizations.

Do not remove the existing NOAA reference information.

==================================================
18. FINAL VALIDATION
==================================================

After implementation:

1. Check for JavaScript errors.
2. Check every navigation tab.
3. Check global filters.
4. Check every 12 class cards.
5. Check 3D viewer.
6. Check modal open/close.
7. Check camera controls.
8. Check auto rotation.
9. Check seabed/shadow/particles/axes toggles.
10. Check parameter explorer.
11. Check correlation.
12. Check data explorer.
13. Check responsive layout.
14. Ensure no existing feature has been accidentally removed.
15. Ensure all dynamic values come from the existing dataset where available.

IMPORTANT:

Do not simply explain what you would do.

Actually modify the existing project files and implement the improvements.

First inspect the project and then make the changes.

After completing the implementation, give me a concise summary of:
- files changed
- major features added
- existing features preserved
- any limitations
- how to run/test the dashboard