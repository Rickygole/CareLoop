from typing import Dict, List, Optional

FHIR_VERSION = "4.0.1"
PORTAL_NAME = "MyHealth"
CONTACT_WINDOW_EXTENSION = "http://careloop.example/fhir/StructureDefinition/preferred-contact-window"

SHARED_CATEGORIES = [
    "Active medication list",
    "Dose schedule",
    "Allergies",
    "Preferred contact window",
]

LIMITATIONS = (
    "Synthetic portal. The bundle is shaped like FHIR R4 and is not validated "
    "against a FHIR server, no terminology service resolved any code, and the "
    "records it returns were written for this demonstration. A real portal "
    "connection would carry coded identifiers rather than display text alone."
)


def _time_of_day(hours: List[int]) -> List[str]:
    return [f"{hour:02d}:00:00" for hour in sorted(hours or [])]


def medication_request_resource(patient: dict, request: dict) -> dict:
    timing = request.get("timing") or {}
    hours = timing.get("preferred_hours") or []
    dosage = {
        "text": " ".join(
            part for part in [request.get("dosage_text"), request.get("frequency")] if part
        ),
        "timing": {
            "repeat": {
                "frequency": timing.get("times_per_day") or len(hours) or 1,
                "period": 1,
                "periodUnit": "d",
                "timeOfDay": _time_of_day(hours),
            }
        },
    }
    resource = {
        "resourceType": "MedicationRequest",
        "id": request["medication_id"],
        "status": request.get("status", "active"),
        "intent": "order",
        "subject": {
            "reference": f"Patient/{patient['patient_id']}",
            "display": patient.get("name"),
        },
        "medicationCodeableConcept": {"text": request.get("medication")},
        "authoredOn": request.get("authored_on") or request.get("start_date"),
        "requester": {"display": request.get("prescriber")},
        "dosageInstruction": [dosage],
    }
    indication = (request.get("indication") or "").strip()
    if indication:
        resource["reasonCode"] = [{"text": indication}]
    return resource


def allergy_resource(patient: dict, allergy: dict) -> dict:
    return {
        "resourceType": "AllergyIntolerance",
        "id": f"{patient['patient_id']}-allergy-{allergy['substance'].lower().replace(' ', '-')}",
        "clinicalStatus": {"coding": [{"code": "active"}]},
        "patient": {
            "reference": f"Patient/{patient['patient_id']}",
            "display": patient.get("name"),
        },
        "code": {"text": allergy.get("substance")},
        "criticality": allergy.get("criticality", "low"),
        "recordedDate": allergy.get("recorded_on"),
        "reaction": [{"manifestation": [{"text": allergy.get("reaction")}]}],
    }


def patient_resource(patient: dict) -> dict:
    window = patient.get("preferred_contact_window") or {}
    resource = {
        "resourceType": "Patient",
        "id": patient["patient_id"],
        "name": [{"text": patient.get("name")}],
    }
    if window:
        resource["extension"] = [{
            "url": CONTACT_WINDOW_EXTENSION,
            "valuePeriod": {"start": window.get("start"), "end": window.get("end")},
            "valueString": window.get("timezone"),
        }]
    return resource


def build_bundle(patient: dict, timestamp: str) -> dict:
    resources = [patient_resource(patient)]
    resources += [
        medication_request_resource(patient, request)
        for request in patient.get("medication_requests", [])
    ]
    resources += [
        allergy_resource(patient, allergy) for allergy in patient.get("allergies", [])
    ]
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "timestamp": timestamp,
        "total": len(resources),
        "meta": {"source": PORTAL_NAME, "profile": [f"http://hl7.org/fhir/{FHIR_VERSION}"]},
        "entry": [
            {"fullUrl": f"urn:uuid:{resource['resourceType']}/{resource['id']}", "resource": resource}
            for resource in resources
        ],
    }


def _identity(request: dict) -> str:
    return "::".join([
        str(request.get("medication")),
        str(request.get("dosage_text")),
        str(request.get("frequency")),
    ])


def _index(medication_requests: List[dict]) -> Dict[str, dict]:
    return {
        request["medication_id"]: request
        for request in medication_requests
        if request.get("status") == "active"
    }


def diff_regimen(previous: Optional[List[dict]], current: List[dict]) -> dict:
    if previous is None:
        return {
            "first_sync": True,
            "changed": False,
            "added": [],
            "removed": [],
            "modified": [],
        }

    before = _index(previous)
    after = _index(current)

    added = [after[key] for key in after if key not in before]
    removed = [before[key] for key in before if key not in after]
    modified = [
        {"before": before[key], "after": after[key]}
        for key in after
        if key in before and _identity(before[key]) != _identity(after[key])
    ]
    return {
        "first_sync": False,
        "changed": bool(added or removed or modified),
        "added": added,
        "removed": removed,
        "modified": modified,
    }


def describe_diff(diff: dict) -> str:
    if diff.get("first_sync"):
        return "First sync. The medication list came across from the portal."
    if not diff.get("changed"):
        return "The portal reports no change since the last sync."
    parts = []
    for request in diff.get("added", []):
        parts.append(f"{request.get('medication')} was added by {request.get('prescriber')}")
    for request in diff.get("removed", []):
        parts.append(f"{request.get('medication')} is no longer on the list")
    for change in diff.get("modified", []):
        parts.append(f"{change['after'].get('medication')} was changed")
    return "The portal reports a change. " + ", ".join(parts) + "."


def apply_portal_changes(patient: dict) -> List[dict]:
    pending = patient.get("portal_pending") or []
    if not pending:
        return []
    known = {request.get("medication_id") for request in patient.get("medication_requests", [])}
    arriving = [request for request in pending if request.get("medication_id") not in known]
    if not arriving:
        return []
    patient["medication_requests"] = patient.get("medication_requests", []) + arriving
    patient["portal_pending"] = [
        request for request in pending if request.get("medication_id") in known
    ]
    return arriving
