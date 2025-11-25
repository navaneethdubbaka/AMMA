/**
 * FHIR R4 Resource Parser
 * Parses Epic FHIR resources into human-readable format for video generation
 */

/**
 * Parse Patient resource to extract demographics
 * @param {Object} patient - FHIR Patient resource
 * @returns {Object} Parsed patient data
 */
export function parsePatient(patient) {
  if (!patient || patient.resourceType !== 'Patient') {
    throw new Error('Invalid Patient resource');
  }

  const name = patient.name?.[0];
  const firstName = name?.given?.join(' ') || '';
  const lastName = name?.family || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    id: patient.id,
    name: fullName,
    firstName,
    lastName,
    gender: patient.gender || 'unknown',
    birthDate: patient.birthDate || null,
    age: patient.birthDate ? calculateAge(patient.birthDate) : null,
    mrn: extractMRN(patient.identifier),
    phone: patient.telecom?.find(t => t.system === 'phone')?.value || null,
    email: patient.telecom?.find(t => t.system === 'email')?.value || null,
    address: formatAddress(patient.address?.[0]),
    raw: patient
  };
}

/**
 * Parse Condition resources (diagnoses)
 * @param {Array} conditions - Array of FHIR Condition resources
 * @returns {Array} Parsed conditions
 */
export function parseConditions(conditions) {
  if (!Array.isArray(conditions)) {
    return [];
  }

  return conditions
    .filter(c => c.resourceType === 'Condition')
    .map(condition => ({
      id: condition.id,
      code: condition.code?.coding?.[0]?.code || null,
      system: condition.code?.coding?.[0]?.system || null,
      display: condition.code?.coding?.[0]?.display || 
               condition.code?.text || 
               'Unknown condition',
      clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || null,
      verificationStatus: condition.verificationStatus?.coding?.[0]?.code || null,
      category: condition.category?.[0]?.coding?.[0]?.display || 'General',
      severity: condition.severity?.coding?.[0]?.display || null,
      onsetDate: condition.onsetDateTime || condition.recordedDate || null,
      note: condition.note?.[0]?.text || null,
      raw: condition
    }))
    .sort((a, b) => new Date(b.onsetDate) - new Date(a.onsetDate));
}

/**
 * Parse MedicationRequest resources
 * @param {Array} medications - Array of FHIR MedicationRequest resources
 * @returns {Array} Parsed medications
 */
export function parseMedications(medications) {
  if (!Array.isArray(medications)) {
    return [];
  }

  return medications
    .filter(m => m.resourceType === 'MedicationRequest')
    .map(med => {
      const medication = med.medicationCodeableConcept || med.medicationReference;
      const dosage = med.dosageInstruction?.[0];
      
      return {
        id: med.id,
        name: medication?.coding?.[0]?.display || 
              medication?.text || 
              'Unknown medication',
        code: medication?.coding?.[0]?.code || null,
        status: med.status || 'unknown',
        intent: med.intent || 'order',
        dosage: dosage?.text || formatDosage(dosage),
        frequency: dosage?.timing?.code?.text || null,
        route: dosage?.route?.coding?.[0]?.display || null,
        quantity: med.dispenseRequest?.quantity?.value || null,
        refills: med.dispenseRequest?.numberOfRepeatsAllowed || 0,
        prescribedDate: med.authoredOn || null,
        instructions: dosage?.patientInstruction || null,
        raw: med
      };
    })
    .sort((a, b) => new Date(b.prescribedDate) - new Date(a.prescribedDate));
}

/**
 * Parse DocumentReference resources (clinical notes)
 * @param {Array} documents - Array of FHIR DocumentReference resources
 * @returns {Array} Parsed documents
 */
export function parseDocuments(documents) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .filter(d => d.resourceType === 'DocumentReference')
    .map(doc => ({
      id: doc.id,
      type: doc.type?.coding?.[0]?.display || doc.type?.text || 'Clinical Note',
      category: doc.category?.[0]?.coding?.[0]?.display || 'General',
      date: doc.date || doc.context?.period?.start || null,
      author: doc.author?.[0]?.display || 'Unknown',
      description: doc.description || null,
      content: doc.content?.[0]?.attachment?.data || null,
      contentType: doc.content?.[0]?.attachment?.contentType || 'text/plain',
      url: doc.content?.[0]?.attachment?.url || null,
      raw: doc
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Parse Observation resources (lab results, vitals)
 * @param {Array} observations - Array of FHIR Observation resources
 * @returns {Array} Parsed observations
 */
export function parseObservations(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .filter(o => o.resourceType === 'Observation')
    .map(obs => ({
      id: obs.id,
      code: obs.code?.coding?.[0]?.code || null,
      display: obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown',
      category: obs.category?.[0]?.coding?.[0]?.display || 'General',
      value: formatObservationValue(obs),
      unit: obs.valueQuantity?.unit || null,
      referenceRange: obs.referenceRange?.[0]?.text || null,
      status: obs.status || 'unknown',
      date: obs.effectiveDateTime || obs.issued || null,
      interpretation: obs.interpretation?.[0]?.coding?.[0]?.display || null,
      raw: obs
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Generate a clinical summary from parsed FHIR data
 * @param {Object} patientData - Object containing parsed FHIR resources
 * @returns {string} Formatted clinical summary for video generation
 */
export function generateClinicalSummary(patientData) {
  const { patient, conditions, medications, documents, observations } = patientData;

  let summary = '';

  // Patient Demographics
  if (patient) {
    summary += `PATIENT INFORMATION\n`;
    summary += `Name: ${patient.name}\n`;
    summary += `Age: ${patient.age} years old\n`;
    summary += `Gender: ${patient.gender}\n`;
    summary += `MRN: ${patient.mrn}\n\n`;
  }

  // Active Conditions
  if (conditions && conditions.length > 0) {
    summary += `DIAGNOSES\n`;
    const activeConditions = conditions.filter(
      c => c.clinicalStatus === 'active' || !c.clinicalStatus
    );
    activeConditions.forEach((condition, idx) => {
      summary += `${idx + 1}. ${condition.display}`;
      if (condition.onsetDate) {
        summary += ` (since ${formatDate(condition.onsetDate)})`;
      }
      if (condition.note) {
        summary += `\n   Note: ${condition.note}`;
      }
      summary += '\n';
    });
    summary += '\n';
  }

  // Current Medications
  if (medications && medications.length > 0) {
    summary += `CURRENT MEDICATIONS\n`;
    const activeMeds = medications.filter(
      m => m.status === 'active' || m.status === 'unknown'
    );
    activeMeds.forEach((med, idx) => {
      summary += `${idx + 1}. ${med.name}`;
      if (med.dosage) {
        summary += ` - ${med.dosage}`;
      }
      if (med.frequency) {
        summary += ` (${med.frequency})`;
      }
      if (med.instructions) {
        summary += `\n   Instructions: ${med.instructions}`;
      }
      summary += '\n';
    });
    summary += '\n';
  }

  // Recent Clinical Notes
  if (documents && documents.length > 0) {
    summary += `RECENT CLINICAL NOTES\n`;
    documents.slice(0, 3).forEach((doc, idx) => {
      summary += `${idx + 1}. ${doc.type} - ${formatDate(doc.date)}\n`;
      if (doc.description) {
        summary += `   ${doc.description}\n`;
      }
    });
    summary += '\n';
  }

  // Recent Lab Results (if available)
  if (observations && observations.length > 0) {
    summary += `RECENT LAB RESULTS\n`;
    const labs = observations.filter(o => o.category === 'laboratory');
    labs.slice(0, 5).forEach((lab, idx) => {
      summary += `${idx + 1}. ${lab.display}: ${lab.value}`;
      if (lab.unit) {
        summary += ` ${lab.unit}`;
      }
      if (lab.interpretation) {
        summary += ` (${lab.interpretation})`;
      }
      summary += ` - ${formatDate(lab.date)}\n`;
    });
  }

  return summary.trim();
}

// Helper Functions

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function extractMRN(identifiers) {
  if (!Array.isArray(identifiers)) return null;
  
  // Look for MRN in common identifier systems
  const mrn = identifiers.find(
    id => id.type?.coding?.some(c => c.code === 'MR') ||
          id.type?.text?.toLowerCase().includes('mrn') ||
          id.system?.includes('mrn')
  );
  
  return mrn?.value || identifiers[0]?.value || null;
}

function formatAddress(address) {
  if (!address) return null;
  
  const parts = [
    address.line?.join(', '),
    address.city,
    address.state,
    address.postalCode
  ].filter(Boolean);
  
  return parts.join(', ') || null;
}

function formatDosage(dosage) {
  if (!dosage) return null;
  
  const dose = dosage.doseAndRate?.[0]?.doseQuantity;
  if (!dose) return null;
  
  return `${dose.value} ${dose.unit}`;
}

function formatObservationValue(obs) {
  if (obs.valueQuantity) {
    return `${obs.valueQuantity.value}`;
  }
  if (obs.valueString) {
    return obs.valueString;
  }
  if (obs.valueCodeableConcept) {
    return obs.valueCodeableConcept.coding?.[0]?.display || obs.valueCodeableConcept.text;
  }
  if (obs.valueBoolean !== undefined) {
    return obs.valueBoolean ? 'Yes' : 'No';
  }
  return 'N/A';
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Parse FHIR Bundle (collection of resources)
 * @param {Object} bundle - FHIR Bundle resource
 * @returns {Object} Organized resources by type
 */
export function parseBundle(bundle) {
  if (!bundle || bundle.resourceType !== 'Bundle') {
    throw new Error('Invalid FHIR Bundle');
  }

  const resources = {
    patients: [],
    conditions: [],
    medications: [],
    documents: [],
    observations: []
  };

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;
    if (!resource) return;

    switch (resource.resourceType) {
      case 'Patient':
        resources.patients.push(parsePatient(resource));
        break;
      case 'Condition':
        resources.conditions.push(parseConditions([resource])[0]);
        break;
      case 'MedicationRequest':
        resources.medications.push(parseMedications([resource])[0]);
        break;
      case 'DocumentReference':
        resources.documents.push(parseDocuments([resource])[0]);
        break;
      case 'Observation':
        resources.observations.push(parseObservations([resource])[0]);
        break;
    }
  });

  return resources;
}

/**
 * Validate FHIR resource structure
 * @param {Object} resource - FHIR resource
 * @returns {boolean} True if valid
 */
export function isValidFHIRResource(resource) {
  return resource && 
         typeof resource === 'object' && 
         'resourceType' in resource &&
         'id' in resource;
}

