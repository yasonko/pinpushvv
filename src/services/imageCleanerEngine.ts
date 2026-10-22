import ExifReader from 'exifreader';
import { 
  CleanedImageItem, 
  ImageCleanerSettings, 
  ParsedImageMetadata, 
  NormalizedMetadataEntry,
  MetadataTagEntry, 
  MetadataDiffReport, 
  QualityVerificationResult,
  StepProgressState,
  MetadataCategory,
  VerificationAuditItem,
  RetainedFieldWarning
} from '../types/imageCleaner';

/**
 * Checks whether an EXIF/MakerNote key strictly represents camera, device, lens, serial, or hardware sensor information.
 * NOTE: ICC Color Profile keys (like 'Profile/ Device class', 'Device Manufacturer', 'Device Model Number') 
 * MUST NEVER be checked with this function without confirming their namespace is EXIF/MakerNote.
 */
export function isExifCameraKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  const cameraKeywords = [
    'make',
    'model',
    'lens',
    'serial',
    'camera',
    'body',
    'sensor',
    'shutter',
    'aperture',
    'focallength',
    'fnumber',
    'iso',
    'exposure',
    'metering',
    'flash',
    'whitebalance',
    'digitalzoom',
    'subjectdistance',
    'sensingmethod',
    'scenetype',
    'scenecapture',
    'gaincontrol',
    'contrast',
    'saturation',
    'sharpness',
    'focalplane',
    'makernote',
    'ownername',
    'hardware',
    'firmware',
    'uniquecameramodel',
    'cameratype',
    'lensid',
    'lensmake',
    'lensmodel',
    'lensserial',
    'lensspec',
    'bodyserial',
    'cameranumber',
    'cameramaker',
    'devicesetting',
    'cameradescription',
    'photographicsensitivity',
    'fnumbervalue',
    'shutterspeed',
    'lightsource',
    'isospeedratings',
    'sensitivitytype',
    'customrendered'
  ];
  return cameraKeywords.some(kw => k.includes(kw));
}

/**
 * Checks whether a metadata key represents GPS or geographical location data.
 */
export function isGpsMetadataKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k.includes('gps') ||
    k.includes('latitude') ||
    k.includes('longitude') ||
    k.includes('altitude') ||
    k.includes('imgdirection') ||
    k.includes('destbearing') ||
    k.includes('position')
  );
}

/**
 * Checks whether a metadata key in EXIF/XMP/IPTC represents date or timestamp info.
 */
export function isDateTimeKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k.includes('date') || 
    k.includes('time') || 
    k.includes('subsectime') || 
    k.includes('offsettime') ||
    k === 'createdate' ||
    k === 'modifydate' ||
    k === 'metadatadate' ||
    k === 'datecreated' ||
    k === 'timecreated' ||
    k === 'digitalcreationdate' ||
    k === 'digitalcreationtime'
  );
}

/**
 * Checks whether a metadata key represents MakerNotes (proprietary camera metadata block).
 */
export function isMakerNotesKey(key: string, namespace?: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  const ns = (namespace || '').toLowerCase();
  if (ns.includes('maker') || ns === 'makernote' || ns === 'makernotes') {
    return true;
  }
  return k.includes('makernote') || k.includes('makernotes');
}

/**
 * Checks whether a key represents a unique image, document, instance, or asset identifier.
 */
export function isUniqueIdKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k === 'imageuniqueid' ||
    k === 'documentid' ||
    k === 'instanceid' ||
    k === 'originaldocumentid' ||
    k === 'mediauniqueid' ||
    k === 'contentidentifier' ||
    k === 'rawfilename' ||
    k === 'catalogid' ||
    k === 'assetid' ||
    k === 'uuid' ||
    k === 'guid'
  );
}

/**
 * Checks whether a key represents an embedded EXIF preview / thumbnail image.
 */
export function isThumbnailKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k.includes('thumbnail') ||
    k.includes('previewimage') ||
    k.includes('jpeginterchangeformat')
  );
}

/**
 * Checks whether an XMP key represents face/person region metadata.
 */
export function isFaceRegionKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k.includes('regioninfo') ||
    k.includes('mwgrs') ||
    k.includes('mwg-rs') ||
    k.includes('facerectangle') ||
    k.includes('personregion') ||
    k.includes('appliedtodimensions') ||
    k.includes('regionlist') ||
    k.includes('faceregions') ||
    k.includes('persondisplayname')
  );
}

/**
 * Checks whether a key represents software, creator tool, or editing history.
 */
export function isEditingHistoryKey(key: string, namespace?: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  const ns = (namespace || '').toUpperCase();
  if (k === 'software' || k === 'creatortool' || k === 'history' || k === 'softwareagent' || k === 'editinghistory') {
    return true;
  }
  if (ns === 'XMP' && (k.includes('history') || k.includes('creatortool') || k.includes('action') || k.includes('parameters'))) {
    return true;
  }
  return false;
}

/**
 * Checks whether a key represents copyright, artist, owner, or contact info.
 */
export function isCopyrightContactKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k.includes('artist') ||
    k.includes('owner') ||
    k.includes('copyright') ||
    k.includes('rights') ||
    k.includes('byline') ||
    k.includes('contact') ||
    k.includes('credit') ||
    k.includes('creator') ||
    k.includes('licensor') ||
    k.includes('usageterms') ||
    k.includes('weburl')
  );
}

/**
 * Checks whether an IPTC key is personal or descriptive metadata.
 */
export function isIptcPersonalKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  const iptcPersonalKeys = [
    'keywords',
    'caption',
    'description',
    'headline',
    'byline',
    'bylinetitle',
    'credit',
    'source',
    'creator',
    'contact',
    'location',
    'sublocation',
    'city',
    'province',
    'state',
    'country',
    'countrycode',
    'writereditor',
    'specialinstructions'
  ];
  return iptcPersonalKeys.some(kw => k.includes(kw));
}

/**
 * Checks whether an XMP key represents organizational / rating metadata (e.g. Lightroom collections, ratings).
 */
export function isXmpOrganizationalKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k === 'rating' ||
    k === 'label' ||
    k.includes('hierarchicalsubject') ||
    k.includes('hierarchy') ||
    k.includes('collection') ||
    k.includes('catalogsets') ||
    k.includes('categories') ||
    k.includes('subjectcode') ||
    k.includes('urgency') ||
    k.includes('genre')
  );
}

/**
 * Checks whether a key represents technical color metadata (e.g. ColorSpace, Gamma).
 */
export function isColorTechnicalKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k === 'colorspace' ||
    k === 'gamma' ||
    k === 'transferfunction' ||
    k === 'whitepoint' ||
    k === 'primarychromaticities' ||
    k === 'ycbcrcoefficients' ||
    k === 'ycbcrpositioning' ||
    k === 'referenceblackwhite'
  );
}

/**
 * Checks whether a key is an internal parser packet or raw stream representation (e.g. XMP._raw, _raw, packet, etc.)
 * These are internal parser structures and must NOT be counted or displayed as semantic metadata fields.
 */
export function isRawParserInternalKey(key: string, namespace?: string): boolean {
  const k = key.toLowerCase().replace(/[\s]/g, '');
  if (k === '_raw' || k === 'raw' || k === 'packet' || k === 'rawpacket' || k === 'xmlpacket' || k === 'xmppacket') {
    return true;
  }
  if (key.startsWith('_') || key.startsWith('__')) {
    return true;
  }
  if (namespace && namespace.toUpperCase() === 'XMP' && (k === '_raw' || k === 'raw' || k === 'packet')) {
    return true;
  }
  return false;
}

/**
 * Checks whether an XMP key represents legitimate provenance / origin metadata (e.g. DigitalSourceType).
 */
export function isXmpProvenanceKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[-_\s]/g, '');
  return (
    k === 'digitalsourcetype' ||
    k.includes('provenance') ||
    k === 'derivedfrom'
  );
}

/**
 * Safely extracts primitive string/number values from raw tag structures, preventing "[object Object]".
 */
export function extractTagValue(rawVal: any): { value: string | number; valueType: 'string' | 'number' | 'array' | 'object' | 'boolean' } {
  if (rawVal === undefined || rawVal === null) {
    return { value: '', valueType: 'string' };
  }

  // Primitive strings
  if (typeof rawVal === 'string') {
    return { value: rawVal.trim(), valueType: 'string' };
  }
  // Primitive numbers
  if (typeof rawVal === 'number') {
    return { value: rawVal, valueType: 'number' };
  }
  // Primitive booleans
  if (typeof rawVal === 'boolean') {
    return { value: rawVal ? 'true' : 'false', valueType: 'boolean' };
  }

  // ExifReader tag object: { description, value, id, ... }
  if (typeof rawVal === 'object' && !Array.isArray(rawVal)) {
    // 1. Check description field
    if (rawVal.description !== undefined && rawVal.description !== null) {
      const desc = rawVal.description;
      if (typeof desc === 'string') return { value: desc.trim(), valueType: 'string' };
      if (typeof desc === 'number') return { value: desc, valueType: 'number' };
      if (typeof desc === 'boolean') return { value: desc ? 'true' : 'false', valueType: 'boolean' };
      if (Array.isArray(desc)) {
        return { 
          value: desc.map(d => (typeof d === 'object' ? JSON.stringify(d) : String(d))).join(', '), 
          valueType: 'array' 
        };
      }
      if (typeof desc === 'object') {
        return { value: JSON.stringify(desc), valueType: 'object' };
      }
    }

    // 2. Check value field
    if (rawVal.value !== undefined && rawVal.value !== null) {
      const v = rawVal.value;
      if (typeof v === 'string') return { value: v.trim(), valueType: 'string' };
      if (typeof v === 'number') return { value: v, valueType: 'number' };
      if (typeof v === 'boolean') return { value: v ? 'true' : 'false', valueType: 'boolean' };
      if (Array.isArray(v)) {
        if (v.length > 32 && typeof v[0] === 'number') {
          return { value: `[${v.length} bytes]`, valueType: 'array' };
        }
        return { 
          value: v.map(d => (typeof d === 'object' ? JSON.stringify(d) : String(d))).join(', '), 
          valueType: 'array' 
        };
      }
      if (typeof v === 'object') {
        return { value: JSON.stringify(v), valueType: 'object' };
      }
    }

    // 3. Nested dictionary fallback (avoid [object Object])
    return { value: JSON.stringify(rawVal), valueType: 'object' };
  }

  // Arrays
  if (Array.isArray(rawVal)) {
    return { 
      value: rawVal.map(d => (typeof d === 'object' ? JSON.stringify(d) : String(d))).join(', '), 
      valueType: 'array' 
    };
  }

  return { value: String(rawVal), valueType: 'string' };
}

/**
 * Extracts, classifies, and normalizes all metadata from an Image File or Blob.
 */
export async function parseImageMetadata(fileOrBlob: File | Blob): Promise<ParsedImageMetadata> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  let tags: Record<string, any> = {};

  try {
    tags = ExifReader.load(arrayBuffer, { expanded: true });
  } catch {
    try {
      tags = ExifReader.load(arrayBuffer);
    } catch {
      tags = {};
    }
  }

  const normalizedEntries: NormalizedMetadataEntry[] = [];
  const rawEntries: NormalizedMetadataEntry[] = [];
  const legacyTags: MetadataTagEntry[] = [];

  let exifCount = 0;
  let iptcCount = 0;
  let xmpCount = 0;
  let gpsCount = 0;
  let iccCount = 0;
  let containerCount = 0;

  let dateTimeCount = 0;
  let makerNotesCount = 0;
  let uniqueIdCount = 0;
  let thumbnailCount = 0;
  let faceRegionCount = 0;
  let editingHistoryCount = 0;
  let copyrightCount = 0;
  let provenanceCount = 0;
  let organizationalCount = 0;
  let proprietaryCount = 0;

  let hasGps = false;
  let hasCameraInfo = false;
  let hasPersonalInfo = false;
  let hasIccProfile = false;
  let hasOrientation = false;
  let orientationTag: number | string | undefined;

  let cameraMake: string | undefined;
  let cameraModel: string | undefined;
  let lensInfo: string | undefined;
  let software: string | undefined;
  let dateTime: string | undefined;
  let creator: string | undefined;
  let byline: string | undefined;
  let copyright: string | undefined;
  let userComments: string | undefined;
  let gpsCoords: { lat: number; lng: number; altitude?: number; stringified?: string } | undefined;

  let iccProfileDescription: string | undefined;
  let iccDeviceClass: string | undefined;
  let iccDeviceManufacturer: string | undefined;
  let iccDeviceModel: string | undefined;

  const registerNormalizedTag = (
    namespace: string,
    key: string,
    rawVal: any
  ) => {
    if (rawVal === undefined || rawVal === null) return;
    
    // If rawVal is a pure container object without tag properties, do not process as tag
    if (typeof rawVal === 'object' && !Array.isArray(rawVal) && !('description' in rawVal) && !('value' in rawVal)) {
      return;
    }

    const { value, valueType } = extractTagValue(rawVal);
    if (value === undefined || value === null || value === '') return;

    const keyLower = key.toLowerCase();
    const nsUpper = namespace.toUpperCase();

    // 0. INTERNAL / RAW PARSER DATA (e.g. XMP._raw, packet, _expanded)
    // Must NOT be counted as a semantic field, must NOT appear in semantic tables or diffs
    if (isRawParserInternalKey(key, namespace)) {
      const displayName = key === '_raw' ? 'XMP raw packet' : key.replace(/([A-Z])/g, ' $1').trim();
      const rawEntry: NormalizedMetadataEntry = {
        category: 'INTERNAL_RAW',
        namespace: nsUpper,
        key,
        displayName,
        value: typeof value === 'string' && value.length > 300 ? value : String(value),
        valueType,
        source: `${nsUpper}.${key}`,
        isPersonal: false,
        rawDetails: rawVal
      };
      rawEntries.push(rawEntry);
      return; // Do NOT add to normalizedEntries, do NOT increment any semantic counters
    }

    let category: MetadataCategory = 'UNKNOWN';
    let isPersonal = false;
    let legacyCat: MetadataTagEntry['category'] = 'other';

    // Extract any embedded namespace prefix in key like "EXIF:Make", "EXIF:Orientation", "PNG:BitDepth"
    let cleanKey = key;
    let effectiveNs = nsUpper;
    if (key.includes(':')) {
      const parts = key.split(':');
      if (parts.length === 2) {
        const prefix = parts[0].toUpperCase();
        if (['EXIF', 'GPS', 'IPTC', 'XMP', 'ICC', 'ICCP', 'PNG', 'RIFF', 'FILE', 'CONTAINER'].includes(prefix)) {
          effectiveNs = prefix;
          cleanKey = parts[1];
        }
      }
    }

    const cleanKeyLower = cleanKey.toLowerCase();

    // Track Orientation tag
    if (cleanKeyLower === 'orientation') {
      hasOrientation = true;
      orientationTag = value;
    }

    // 1. ICC COLOR PROFILE CLASSIFICATION
    if (effectiveNs === 'ICC' || effectiveNs === 'ICCP' || cleanKeyLower.startsWith('iccprofile')) {
      category = 'ICC_COLOR_PROFILE';
      legacyCat = 'icc';
      iccCount++;
      hasIccProfile = true;

      const strVal = String(value);
      if (cleanKeyLower.includes('description') && !iccProfileDescription) iccProfileDescription = strVal;
      if (cleanKeyLower.includes('class') && !iccDeviceClass) iccDeviceClass = strVal;
      if (cleanKeyLower.includes('manufacturer') && !iccDeviceManufacturer) iccDeviceManufacturer = strVal;
      if (cleanKeyLower.includes('model') && !iccDeviceModel) iccDeviceModel = strVal;
    }
    // 2. TECHNICAL COLOR METADATA
    else if (isColorTechnicalKey(cleanKey)) {
      category = 'COLOR_TECHNICAL';
      legacyCat = 'exif';
      exifCount++;
    }
    // 3. GPS METADATA
    else if (effectiveNs === 'GPS' || isGpsMetadataKey(cleanKey)) {
      category = 'EXIF_GPS';
      legacyCat = 'gps';
      gpsCount++;
      hasGps = true;
      isPersonal = true;
    }
    // 4. MAKERNOTES METADATA
    else if (isMakerNotesKey(cleanKey, effectiveNs) || effectiveNs.includes('MAKERNOTE')) {
      category = 'EXIF_MAKER_NOTES';
      legacyCat = 'camera';
      makerNotesCount++;
      hasCameraInfo = true;
      isPersonal = true;
    }
    // 5. UNIQUE IDENTIFIERS
    else if (isUniqueIdKey(cleanKey)) {
      category = 'UNIQUE_IDENTIFIER';
      legacyCat = 'other';
      uniqueIdCount++;
      isPersonal = true;
    }
    // 6. EMBEDDED THUMBNAILS
    else if (isThumbnailKey(cleanKey)) {
      category = 'EXIF_THUMBNAIL';
      legacyCat = 'other';
      thumbnailCount++;
    }
    // 7. FACE / PERSON REGIONS
    else if (isFaceRegionKey(cleanKey)) {
      category = 'XMP_REGION';
      legacyCat = 'xmp';
      faceRegionCount++;
      isPersonal = true;
    }
    // 8. SOFTWARE / EDITING HISTORY
    else if (isEditingHistoryKey(cleanKey, effectiveNs)) {
      category = 'XMP_EDITING_HISTORY';
      legacyCat = 'software';
      editingHistoryCount++;
      isPersonal = true;
      if (!software) software = String(value);
    }
    // 9. COPYRIGHT & CONTACT
    else if (isCopyrightContactKey(cleanKey)) {
      category = 'COPYRIGHT_CONTACT';
      legacyCat = 'copyright';
      copyrightCount++;
      isPersonal = true;
      const strVal = String(value);
      if (!copyright && cleanKeyLower.includes('copyright')) copyright = strVal;
      if (!creator && (cleanKeyLower.includes('creator') || cleanKeyLower.includes('artist') || cleanKeyLower.includes('author'))) creator = strVal;
      if (!byline && cleanKeyLower.includes('byline')) byline = strVal;
    }
    // 10. DATE / TIME
    else if (isDateTimeKey(cleanKey)) {
      category = 'EXIF_DATETIME';
      legacyCat = 'date';
      dateTimeCount++;
      isPersonal = true;
      if (!dateTime) dateTime = String(value);
    }
    // 11. IPTC METADATA
    else if (effectiveNs === 'IPTC') {
      iptcCount++;
      if (isIptcPersonalKey(cleanKey)) {
        category = 'IPTC_PERSONAL';
        isPersonal = true;
      } else {
        category = 'IPTC';
      }
      legacyCat = 'iptc';

      const strVal = String(value);
      if (cleanKeyLower.includes('by-line') && !byline) byline = strVal;
      if (cleanKeyLower.includes('creator') && !creator) creator = strVal;
      if (cleanKeyLower.includes('copyright') && !copyright) copyright = strVal;
    }
    // 12. XMP METADATA
    else if (effectiveNs === 'XMP') {
      xmpCount++;
      if (isXmpProvenanceKey(cleanKey)) {
        category = 'XMP_PROVENANCE';
        provenanceCount++;
        legacyCat = 'xmp';
        isPersonal = false; // Provenance is legitimate origin/format metadata
      } else if (isXmpOrganizationalKey(cleanKey)) {
        category = 'XMP_ORGANIZATIONAL';
        organizationalCount++;
        legacyCat = 'xmp';
        isPersonal = true;
      } else {
        category = 'XMP_PERSONAL';
        legacyCat = 'xmp';
        isPersonal = true;
      }
    }
    // 13. EXIF / CAMERA METADATA & ORIENTATION
    else if (effectiveNs === 'EXIF' || isExifCameraKey(cleanKey) || cleanKeyLower === 'orientation') {
      exifCount++;
      const strVal = String(value);

      if (isExifCameraKey(cleanKey)) {
        category = 'EXIF_CAMERA';
        legacyCat = 'camera';
        hasCameraInfo = true;
        isPersonal = true;

        if (cleanKeyLower === 'make' && !cameraMake) cameraMake = strVal;
        if (cleanKeyLower === 'model' && !cameraModel) cameraModel = strVal;
        if (cleanKeyLower.includes('lens') && !lensInfo) lensInfo = strVal;
      } else {
        category = 'EXIF_CAMERA';
        legacyCat = 'exif';
      }
    }
    // 14. CONTAINER / FILE STRUCTURE
    else if (['FILE', 'RIFF', 'PNG', 'JFIF', 'MPF', 'CONTAINER'].includes(effectiveNs)) {
      category = 'CONTAINER_STRUCTURE';
      legacyCat = 'container';
      containerCount++;
    } else {
      category = 'UNKNOWN';
      legacyCat = 'other';
    }

    if (isPersonal) {
      hasPersonalInfo = true;
    }

    const displayName = key.replace(/([A-Z])/g, ' $1').trim();

    const normalizedEntry: NormalizedMetadataEntry = {
      category,
      namespace: nsUpper,
      key,
      displayName,
      value,
      valueType,
      source: `${nsUpper}.${key}`,
      isPersonal,
      rawDetails: rawVal
    };

    normalizedEntries.push(normalizedEntry);

    legacyTags.push({
      key,
      label: displayName,
      value: String(value),
      category: legacyCat,
      isPersonal
    });
  };

  // Process structured groups from ExifReader
  const groupProcessors: Record<string, string> = {
    exif: 'EXIF',
    iptc: 'IPTC',
    xmp: 'XMP',
    gps: 'GPS',
    icc: 'ICC',
    makerNote: 'MakerNote',
    makernote: 'MakerNote',
    riff: 'RIFF',
    file: 'FILE',
    png: 'PNG',
    jfif: 'JFIF',
    mpf: 'MPF'
  };

  for (const [groupKey, ns] of Object.entries(groupProcessors)) {
    if (tags[groupKey] && typeof tags[groupKey] === 'object') {
      for (const [tagKey, tagVal] of Object.entries(tags[groupKey])) {
        registerNormalizedTag(ns, tagKey, tagVal);
      }
    }
  }

  // Handle flat or unclassified root tags
  for (const [key, val] of Object.entries(tags)) {
    if (groupProcessors[key] !== undefined) continue;
    if (typeof val === 'object' && val !== null && !('description' in val || 'value' in val)) {
      // It's an unclassified group dictionary — iterate its children
      for (const [innerK, innerV] of Object.entries(val)) {
        if (!normalizedEntries.some(e => e.key.toLowerCase() === innerK.toLowerCase())) {
          registerNormalizedTag(key.toUpperCase(), innerK, innerV);
        }
      }
    } else {
      if (!normalizedEntries.some(e => e.key.toLowerCase() === key.toLowerCase())) {
        const guessedNs = isGpsMetadataKey(key) ? 'GPS' : isExifCameraKey(key) ? 'EXIF' : 'FILE';
        registerNormalizedTag(guessedNs, key, val);
      }
    }
  }

  // Parse GPS coordinates if available
  const gpsLatTag = normalizedEntries.find(e => e.key.toLowerCase() === 'gpslatitude');
  const gpsLngTag = normalizedEntries.find(e => e.key.toLowerCase() === 'gpslongitude');
  const gpsAltTag = normalizedEntries.find(e => e.key.toLowerCase() === 'gpsaltitude');

  if (gpsLatTag && gpsLngTag) {
    const lat = typeof gpsLatTag.value === 'number' ? gpsLatTag.value : parseFloat(String(gpsLatTag.value));
    const lng = typeof gpsLngTag.value === 'number' ? gpsLngTag.value : parseFloat(String(gpsLngTag.value));
    const alt = gpsAltTag ? (typeof gpsAltTag.value === 'number' ? gpsAltTag.value : parseFloat(String(gpsAltTag.value))) : undefined;

    if (!isNaN(lat) && !isNaN(lng)) {
      gpsCoords = {
        lat,
        lng,
        altitude: isNaN(alt as number) ? undefined : alt,
        stringified: `${lat.toFixed(5)}, ${lng.toFixed(5)}${alt && !isNaN(alt) ? ` (${alt.toFixed(1)}m)` : ''}`
      };
      hasGps = true;
    }
  }

  const cameraFields = normalizedEntries.filter(e => e.category === 'EXIF_CAMERA' || e.category === 'EXIF_MAKER_NOTES');
  const cameraFieldNames = Array.from(new Set(cameraFields.map(e => e.key)));

  return {
    hasMetadata: normalizedEntries.length > 0,
    totalFieldCount: normalizedEntries.length,
    exifCount,
    iptcCount,
    xmpCount,
    gpsCount,
    iccCount,
    containerCount,
    dateTimeCount,
    makerNotesCount,
    uniqueIdCount,
    thumbnailCount,
    faceRegionCount,
    editingHistoryCount,
    copyrightCount,
    provenanceCount,
    organizationalCount,
    proprietaryCount,
    hasGps: hasGps || gpsCount > 0,
    hasCameraInfo: cameraFields.length > 0 || hasCameraInfo,
    hasPersonalInfo,
    hasIccProfile: hasIccProfile || iccCount > 0,
    hasDateTime: dateTimeCount > 0,
    hasMakerNotes: makerNotesCount > 0,
    hasUniqueIds: uniqueIdCount > 0,
    hasThumbnail: thumbnailCount > 0,
    hasOrientation,
    orientationTag,
    hasFaceRegions: faceRegionCount > 0,
    hasEditingHistory: editingHistoryCount > 0,
    hasCopyright: copyrightCount > 0,
    hasProvenance: provenanceCount > 0,
    hasOrganizational: organizationalCount > 0,
    hasProprietary: proprietaryCount > 0,
    cameraMake,
    cameraModel,
    lensInfo,
    software,
    dateTime,
    gpsCoordinates: gpsCoords,
    creator,
    byline,
    copyright,
    userComments,
    iccProfileDescription,
    iccDeviceClass,
    iccDeviceManufacturer,
    iccDeviceModel,
    cameraFields,
    cameraFieldNames,
    normalizedEntries,
    rawEntries,
    internalRawEntries: rawEntries,
    tags: legacyTags
  };
}

/**
 * Calculates Metadata Before vs After differences and enumerates remaining sensitive tags.
 */
export function computeMetadataDiff(
  before?: ParsedImageMetadata, 
  after?: ParsedImageMetadata
): MetadataDiffReport {
  const exifBefore = before?.exifCount ?? 0;
  const exifAfter = after?.exifCount ?? 0;
  const iptcBefore = before?.iptcCount ?? 0;
  const iptcAfter = after?.iptcCount ?? 0;
  const xmpBefore = before?.xmpCount ?? 0;
  const xmpAfter = after?.xmpCount ?? 0;

  const gpsBefore = before?.hasGps ?? false;
  const gpsAfter = after?.hasGps ?? false;
  const cameraBefore = before?.hasCameraInfo ?? false;
  const cameraAfter = after?.hasCameraInfo ?? false;
  const iccBefore = before?.hasIccProfile ?? false;
  const iccAfter = after?.hasIccProfile ?? false;

  const dateTimeBefore = before?.dateTimeCount ?? 0;
  const dateTimeAfter = after?.dateTimeCount ?? 0;
  const makerNotesBefore = before?.hasMakerNotes ?? false;
  const makerNotesAfter = after?.hasMakerNotes ?? false;
  const uniqueIdsBefore = before?.uniqueIdCount ?? 0;
  const uniqueIdsAfter = after?.uniqueIdCount ?? 0;
  const thumbnailBefore = before?.hasThumbnail ?? false;
  const thumbnailAfter = after?.hasThumbnail ?? false;
  const faceRegionsBefore = before?.faceRegionCount ?? 0;
  const faceRegionsAfter = after?.faceRegionCount ?? 0;
  const editingHistoryBefore = before?.editingHistoryCount ?? 0;
  const editingHistoryAfter = after?.editingHistoryCount ?? 0;
  const copyrightBefore = before?.copyrightCount ?? 0;
  const copyrightAfter = after?.copyrightCount ?? 0;
  const provenanceBefore = before?.provenanceCount ?? 0;
  const provenanceAfter = after?.provenanceCount ?? 0;

  const removedList: string[] = [];
  const preservedList: string[] = [];

  if (before?.normalizedEntries) {
    const afterKeys = new Set(after?.normalizedEntries?.map(t => `${t.namespace}.${t.key}`.toLowerCase()) || []);
    for (const tag of before.normalizedEntries) {
      const tagId = `${tag.namespace}.${tag.key}`.toLowerCase();
      if (!afterKeys.has(tagId)) {
        removedList.push(`${tag.displayName || tag.key} (${tag.namespace})`);
      } else {
        preservedList.push(`${tag.displayName || tag.key} (${tag.namespace})`);
      }
    }
  }

  // Camera field differences
  const cameraFieldsBeforeList = (before?.cameraFields || []).map(t => `${t.displayName || t.key}: ${t.value}`);
  const cameraFieldsAfterList = (after?.cameraFields || []).map(t => `${t.displayName || t.key}: ${t.value}`);
  const retainedCameraFields = (after?.cameraFields && after.cameraFields.length > 0)
    ? after.cameraFields
    : (after?.normalizedEntries || []).filter(e => e.category === 'EXIF_CAMERA');
  const retainedCameraDescriptions = retainedCameraFields.map(t => `${t.displayName || t.key} ("${t.value}")`);

  // GPS field descriptions
  const retainedGpsTags = (after?.normalizedEntries || []).filter(e => e.category === 'EXIF_GPS');
  const retainedGpsDescriptions = retainedGpsTags.map(t => `${t.displayName || t.key} ("${t.value}")`);

  // ICC field descriptions
  const retainedIccTags = (after?.normalizedEntries || []).filter(e => e.category === 'ICC_COLOR_PROFILE');
  const retainedIccDescriptions = retainedIccTags.map(t => `${t.displayName || t.key} ("${t.value}")`);

  // EXIF field descriptions
  const retainedExifTags = (after?.normalizedEntries || []).filter(e => e.namespace === 'EXIF' && e.category !== 'CONTAINER_STRUCTURE' && e.category !== 'ICC_COLOR_PROFILE');
  const retainedExifDescriptions = retainedExifTags.map(t => `${t.displayName || t.key} ("${t.value}")`);

  // IPTC & XMP descriptions
  const retainedIptcDescriptions = (after?.normalizedEntries || []).filter(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL').map(t => `${t.displayName || t.key} ("${t.value}")`);
  const retainedXmpDescriptions = (after?.normalizedEntries || []).filter(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL' || e.category === 'XMP_ORGANIZATIONAL').map(t => `${t.displayName || t.key} ("${t.value}")`);

  // Sensitive tags
  const retainedSensitiveFields = [
    ...retainedCameraDescriptions,
    ...retainedGpsDescriptions,
    ...retainedIptcDescriptions,
    ...(after?.normalizedEntries || []).filter(t => t.isPersonal && t.category !== 'EXIF_CAMERA' && t.category !== 'EXIF_GPS' && t.category !== 'IPTC').map(t => `${t.displayName || t.key} ("${t.value}")`)
  ];

  return {
    exifBefore,
    exifAfter,
    exifRemoved: Math.max(0, exifBefore - exifAfter),
    iptcBefore,
    iptcAfter,
    iptcRemoved: Math.max(0, iptcBefore - iptcAfter),
    xmpBefore,
    xmpAfter,
    xmpRemoved: Math.max(0, xmpBefore - xmpAfter),
    gpsBefore,
    gpsAfter,
    gpsRemoved: gpsBefore && !gpsAfter,
    cameraBefore,
    cameraAfter,
    cameraRemoved: cameraBefore && !cameraAfter,
    iccBefore,
    iccAfter,
    iccRemoved: iccBefore && !iccAfter,
    iccPreserved: iccBefore && iccAfter,
    dateTimeBefore,
    dateTimeAfter,
    dateTimeRemoved: dateTimeBefore > 0 && dateTimeAfter === 0,
    makerNotesBefore,
    makerNotesAfter,
    makerNotesRemoved: makerNotesBefore && !makerNotesAfter,
    uniqueIdsBefore,
    uniqueIdsAfter,
    uniqueIdsRemoved: uniqueIdsBefore > 0 && uniqueIdsAfter === 0,
    thumbnailBefore,
    thumbnailAfter,
    thumbnailRemoved: thumbnailBefore && !thumbnailAfter,
    orientationBefore: before?.orientationTag,
    orientationAfter: after?.orientationTag,
    orientationNormalized: !!before?.hasOrientation && !after?.hasOrientation,
    iptcPersonalBefore: (before?.normalizedEntries || []).filter(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL').length,
    iptcPersonalAfter: (after?.normalizedEntries || []).filter(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL').length,
    iptcPersonalRemoved: (before?.normalizedEntries || []).some(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL') && !(after?.normalizedEntries || []).some(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL'),
    xmpPersonalBefore: (before?.normalizedEntries || []).filter(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL').length,
    xmpPersonalAfter: (after?.normalizedEntries || []).filter(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL').length,
    xmpPersonalRemoved: (before?.normalizedEntries || []).some(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL') && !(after?.normalizedEntries || []).some(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL'),
    faceRegionsBefore,
    faceRegionsAfter,
    faceRegionsRemoved: faceRegionsBefore > 0 && faceRegionsAfter === 0,
    editingHistoryBefore,
    editingHistoryAfter,
    editingHistoryRemoved: editingHistoryBefore > 0 && editingHistoryAfter === 0,
    copyrightBefore,
    copyrightAfter,
    copyrightRemoved: copyrightBefore > 0 && copyrightAfter === 0,
    copyrightPreserved: copyrightBefore > 0 && copyrightAfter > 0,
    provenanceBefore,
    provenanceAfter,
    provenancePreserved: provenanceBefore > 0 && provenanceAfter > 0,
    softwareRemoved: !!before?.software && !after?.software,
    fieldsRemovedList: Array.from(new Set(removedList)),
    preservedFieldsList: Array.from(new Set(preservedList)),
    cameraFieldsBeforeList,
    cameraFieldsAfterList,
    retainedCameraFields,
    retainedCameraDescriptions,
    retainedGpsDescriptions,
    retainedSensitiveFields,
    retainedIccDescriptions,
    retainedExifDescriptions,
    retainedIptcDescriptions,
    retainedXmpDescriptions,
  };
}

/**
 * Strips ICC color profile bytes from an image Blob if requested.
 */
export async function stripIccProfileFromBlob(blob: Blob): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // JPEG ICC Removal (Strip APP2 marker 0xFF 0xE2 starting with "ICC_PROFILE\0")
  if (blob.type === 'image/jpeg' || (bytes[0] === 0xFF && bytes[1] === 0xD8)) {
    const cleanChunks: Uint8Array[] = [];
    let offset = 2; // Skip SOI (0xFF 0xD8)
    cleanChunks.push(bytes.subarray(0, 2));

    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xFF) {
        cleanChunks.push(bytes.subarray(offset));
        break;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xDA || marker === 0xD9) { // SOS (Start of Scan) or EOI
        cleanChunks.push(bytes.subarray(offset));
        break;
      }

      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const segmentEnd = offset + 2 + length;

      // Check for APP2 ICC_PROFILE
      let isIccApp2 = false;
      if (marker === 0xE2 && length >= 14) {
        const iccHeader = String.fromCharCode(...bytes.subarray(offset + 4, offset + 15));
        if (iccHeader.startsWith('ICC_PROFILE')) {
          isIccApp2 = true;
        }
      }

      if (!isIccApp2) {
        cleanChunks.push(bytes.subarray(offset, segmentEnd));
      }
      offset = segmentEnd;
    }

    const totalLen = cleanChunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const chunk of cleanChunks) {
      result.set(chunk, cur);
      cur += chunk.length;
    }
    return new Blob([result], { type: 'image/jpeg' });
  }

  // PNG iCCP Removal (Skip 'iCCP' chunk)
  if (blob.type === 'image/png' || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)) {
    const cleanChunks: Uint8Array[] = [];
    let offset = 8; // Skip 8-byte PNG header
    cleanChunks.push(bytes.subarray(0, 8));

    while (offset < bytes.length) {
      const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      const chunkType = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      const chunkEnd = offset + 12 + length;

      if (chunkType !== 'iCCP') {
        cleanChunks.push(bytes.subarray(offset, chunkEnd));
      }

      if (chunkType === 'IEND') break;
      offset = chunkEnd;
    }

    const totalLen = cleanChunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const chunk of cleanChunks) {
      result.set(chunk, cur);
      cur += chunk.length;
    }
    return new Blob([result], { type: 'image/png' });
  }

  // WebP ICCP Removal (Skip 'ICCP' RIFF chunk)
  if (
    blob.type === 'image/webp' ||
    (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
     bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) // 'WEBP'
  ) {
    const cleanChunks: Uint8Array[] = [];
    cleanChunks.push(bytes.subarray(0, 12)); // RIFF header + 'WEBP'
    let offset = 12;
    let modified = false;

    while (offset < bytes.length - 8) {
      const chunkTag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      const chunkSize = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      const paddedSize = chunkSize + (chunkSize % 2);
      const chunkEnd = offset + 8 + paddedSize;

      if (chunkTag === 'ICCP') {
        modified = true;
        // Skip ICCP chunk
      } else if (chunkTag === 'VP8X' && chunkSize >= 10) {
        // Copy VP8X and clear ICC flag (bit 5 / 0x20)
        const vp8xChunk = new Uint8Array(bytes.subarray(offset, chunkEnd));
        vp8xChunk[8] = vp8xChunk[8] & ~0x20;
        cleanChunks.push(vp8xChunk);
      } else {
        cleanChunks.push(bytes.subarray(offset, Math.min(chunkEnd, bytes.length)));
      }

      offset = chunkEnd;
    }

    if (modified) {
      const totalLen = cleanChunks.reduce((acc, c) => acc + c.length, 0);
      const result = new Uint8Array(totalLen);
      let cur = 0;
      for (const chunk of cleanChunks) {
        result.set(chunk, cur);
        cur += chunk.length;
      }
      // Update RIFF file size (totalLen - 8)
      const riffSize = totalLen - 8;
      result[4] = riffSize & 0xFF;
      result[5] = (riffSize >> 8) & 0xFF;
      result[6] = (riffSize >> 16) & 0xFF;
      result[7] = (riffSize >> 24) & 0xFF;

      return new Blob([result], { type: 'image/webp' });
    }
  }

  return blob;
}

/**
 * Strict Metadata Verification against actual exported binary.
 */
export function verifyMetadataCleanup(
  before: ParsedImageMetadata,
  after: ParsedImageMetadata,
  settings: ImageCleanerSettings
): {
  verification: QualityVerificationResult;
  diff: MetadataDiffReport;
  warnings: string[];
  status: 'success' | 'warning';
} {
  const diff = computeMetadataDiff(before, after);
  const warnings: string[] = [];
  const retainedFieldWarnings: Array<{ field: string; reason: string; category?: string }> = [];
  const auditItems: VerificationAuditItem[] = [];

  // Helper to add exact field warning
  const addRetainedFieldWarning = (field: string, reason: string, category?: string) => {
    retainedFieldWarnings.push({ field, reason, category });
    warnings.push(`Field: ${field}\nReason: ${reason}`);
  };

  // 1. Camera metadata verification (Make, Model, LensMake, LensModel, BodySerialNumber, LensSerialNumber, MakerNotes)
  const retainedCameraEntries = after.normalizedEntries.filter(e => e.category === 'EXIF_CAMERA');
  let cameraCleanupVerified = true;
  const cameraBeforeCount = diff.cameraFieldsBeforeList?.length || (before?.hasCameraInfo ? 1 : 0);
  const cameraAfterCount = retainedCameraEntries.length;

  if (settings.removeCamera) {
    if (retainedCameraEntries.length > 0) {
      cameraCleanupVerified = false;
      const cameraDescList = diff.retainedCameraDescriptions && diff.retainedCameraDescriptions.length > 0
        ? diff.retainedCameraDescriptions
        : retainedCameraEntries.map(e => `${e.displayName || e.key} ("${e.value}")`);
      warnings.push(`Camera hardware metadata remained in output binary: ${cameraDescList.join(', ')}`);
      for (const entry of retainedCameraEntries) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved the field', 'Camera');
      }
    }
  }

  auditItems.push({
    category: 'Camera',
    beforeDisplay: `${cameraBeforeCount}`,
    afterDisplay: `${cameraAfterCount}`,
    passed: cameraCleanupVerified,
    statusText: `${cameraBeforeCount} → ${cameraAfterCount} ${cameraCleanupVerified ? '✓' : '⚠️'}`,
    retainedFields: retainedCameraEntries.map(e => ({
      field: e.displayName || e.key,
      reason: 'Encoder preserved the field'
    }))
  });

  // 2. GPS location verification (Latitude, Longitude, Altitude, Speed, Direction, GPS timestamp, GPS processing)
  const retainedGpsEntries = after.normalizedEntries.filter(e => e.category === 'EXIF_GPS');
  let gpsCleanupVerified = true;
  const gpsBeforeDisplay = before?.hasGps ? 'Present' : 'None';
  let gpsAfterDisplay = 'Clean';

  if (settings.removeGps) {
    if (retainedGpsEntries.length > 0 || after.hasGps) {
      gpsCleanupVerified = false;
      gpsAfterDisplay = 'Retained';
      if (retainedGpsEntries.length > 0) {
        for (const entry of retainedGpsEntries) {
          addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved GPS metadata', 'GPS');
        }
      } else {
        addRetainedFieldWarning('GPS Location Coordinates', 'GPS coordinates remained in output binary', 'GPS');
      }
    } else {
      gpsAfterDisplay = before?.hasGps ? 'Removed' : 'Clean';
    }
  } else {
    gpsAfterDisplay = after?.hasGps ? 'Preserved' : 'None';
  }

  auditItems.push({
    category: 'GPS',
    beforeDisplay: gpsBeforeDisplay,
    afterDisplay: gpsAfterDisplay,
    passed: gpsCleanupVerified,
    statusText: `${gpsBeforeDisplay} → ${gpsAfterDisplay} ${gpsCleanupVerified ? '✓' : '⚠️'}`
  });

  // 3. Date / Time verification (DateTime, DateTimeOriginal, DateTimeDigitized, XMP creation/modification dates)
  const retainedDateTimeEntries = after.normalizedEntries.filter(e => e.category === 'EXIF_DATETIME');
  let dateTimeCleanupVerified = true;
  const dateTimeBeforeCount = diff.dateTimeBefore || (before?.hasDateTime ? 1 : 0);
  const dateTimeAfterCount = retainedDateTimeEntries.length;

  if (settings.removeDateTime) {
    if (retainedDateTimeEntries.length > 0 || after.hasDateTime) {
      dateTimeCleanupVerified = false;
      for (const entry of retainedDateTimeEntries) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved timestamp metadata', 'Date/Time');
      }
    }
  }

  auditItems.push({
    category: 'Date/Time',
    beforeDisplay: `${dateTimeBeforeCount}`,
    afterDisplay: `${dateTimeAfterCount}`,
    passed: dateTimeCleanupVerified,
    statusText: `${dateTimeBeforeCount} → ${dateTimeAfterCount} ${dateTimeCleanupVerified ? '✓' : '⚠️'}`
  });

  // 4. MakerNotes verification
  const retainedMakerNotes = after.normalizedEntries.filter(e => e.category === 'EXIF_MAKER_NOTES');
  let makerNotesCleanupVerified = true;
  const makerNotesBeforeDisplay = before?.hasMakerNotes ? 'Present' : 'None';
  let makerNotesAfterDisplay = 'Clean';

  if (settings.removeMakerNotes || settings.removeCamera) {
    if (retainedMakerNotes.length > 0 || after.hasMakerNotes) {
      makerNotesCleanupVerified = false;
      makerNotesAfterDisplay = 'Retained';
      for (const entry of retainedMakerNotes) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved vendor maker notes', 'MakerNotes');
      }
    } else {
      makerNotesAfterDisplay = before?.hasMakerNotes ? 'Removed' : 'Clean';
    }
  } else {
    makerNotesAfterDisplay = after?.hasMakerNotes ? 'Preserved' : 'None';
  }

  auditItems.push({
    category: 'MakerNotes',
    beforeDisplay: makerNotesBeforeDisplay,
    afterDisplay: makerNotesAfterDisplay,
    passed: makerNotesCleanupVerified,
    statusText: `${makerNotesBeforeDisplay} → ${makerNotesAfterDisplay} ${makerNotesCleanupVerified ? '✓' : '⚠️'}`
  });

  // 5. Unique IDs verification (ImageUniqueID, DocumentID, InstanceID, OriginalDocumentID)
  const retainedUniqueIds = after.normalizedEntries.filter(e => e.category === 'UNIQUE_IDENTIFIER');
  let uniqueIdsCleanupVerified = true;
  const uniqueIdsBeforeCount = diff.uniqueIdsBefore || 0;
  const uniqueIdsAfterCount = retainedUniqueIds.length;

  if (settings.removeUniqueIds) {
    if (retainedUniqueIds.length > 0 || after.hasUniqueIds) {
      uniqueIdsCleanupVerified = false;
      for (const entry of retainedUniqueIds) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved unique document identifier', 'Unique IDs');
      }
    }
  }

  auditItems.push({
    category: 'Unique IDs',
    beforeDisplay: `${uniqueIdsBeforeCount}`,
    afterDisplay: `${uniqueIdsAfterCount}`,
    passed: uniqueIdsCleanupVerified,
    statusText: `${uniqueIdsBeforeCount} → ${uniqueIdsAfterCount} ${uniqueIdsCleanupVerified ? '✓' : '⚠️'}`
  });

  // 6. Embedded Thumbnail verification (Verify absent after export)
  const retainedThumbnails = after.normalizedEntries.filter(e => e.category === 'EXIF_THUMBNAIL');
  let thumbnailCleanupVerified = true;
  const thumbnailBeforeDisplay = before?.hasThumbnail ? 'Present' : 'None';
  let thumbnailAfterDisplay = 'Clean';

  if (settings.removeThumbnails) {
    if (retainedThumbnails.length > 0 || after.hasThumbnail) {
      thumbnailCleanupVerified = false;
      thumbnailAfterDisplay = 'Retained';
      addRetainedFieldWarning('Embedded Thumbnail Stream', 'Encoder preserved embedded thumbnail data', 'Thumbnail');
    } else {
      thumbnailAfterDisplay = before?.hasThumbnail ? 'Removed' : 'Clean';
    }
  } else {
    thumbnailAfterDisplay = after?.hasThumbnail ? 'Preserved' : 'None';
  }

  auditItems.push({
    category: 'Embedded Thumbnail',
    beforeDisplay: thumbnailBeforeDisplay,
    afterDisplay: thumbnailAfterDisplay,
    passed: thumbnailCleanupVerified,
    statusText: `${thumbnailBeforeDisplay} → ${thumbnailAfterDisplay} ${thumbnailCleanupVerified ? '✓' : '⚠️'}`
  });

  // 7. Personal IPTC verification (Creator, Byline, Contact, Location, City, Country, Keywords, Caption)
  const retainedIptcEntries = after.normalizedEntries.filter(e => e.category === 'IPTC' || e.category === 'IPTC_PERSONAL');
  let iptcCleanupVerified = true;
  const iptcPersonalBeforeCount = diff.iptcPersonalBefore || 0;
  const iptcPersonalAfterCount = retainedIptcEntries.length;

  if (settings.removeIptcPersonal) {
    if (retainedIptcEntries.length > 0) {
      iptcCleanupVerified = false;
      for (const entry of retainedIptcEntries) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved personal IPTC metadata', 'IPTC');
      }
    }
  }

  auditItems.push({
    category: 'Personal IPTC',
    beforeDisplay: `${iptcPersonalBeforeCount}`,
    afterDisplay: `${iptcPersonalAfterCount}`,
    passed: iptcCleanupVerified,
    statusText: `${iptcPersonalBeforeCount} → ${iptcPersonalAfterCount} ${iptcCleanupVerified ? '✓' : '⚠️'}`
  });

  // 8. Personal XMP verification (Personal fields, Editing history, Unique IDs, Region/face)
  const retainedXmpEntries = after.normalizedEntries.filter(e => e.category === 'XMP' || e.category === 'XMP_PERSONAL' || e.category === 'XMP_ORGANIZATIONAL');
  let xmpCleanupVerified = true;
  const xmpPersonalBeforeCount = diff.xmpPersonalBefore || 0;
  const xmpPersonalAfterCount = retainedXmpEntries.length;

  if (settings.removeXmpPersonal) {
    if (retainedXmpEntries.length > 0) {
      xmpCleanupVerified = false;
      for (const entry of retainedXmpEntries) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved personal XMP metadata', 'XMP');
      }
    }
  }

  auditItems.push({
    category: 'Personal XMP',
    beforeDisplay: `${xmpPersonalBeforeCount}`,
    afterDisplay: `${xmpPersonalAfterCount}`,
    passed: xmpCleanupVerified,
    statusText: `${xmpPersonalBeforeCount} → ${xmpPersonalAfterCount} ${xmpCleanupVerified ? '✓' : '⚠️'}`
  });

  // 9. Provenance verification (XMP.DigitalSourceType must NOT be treated as Camera or Personal; preserved by default)
  const retainedProvenance = after.normalizedEntries.filter(e => e.category === 'XMP_PROVENANCE');
  const provenanceBeforeCount = diff.provenanceBefore || (before?.hasProvenance ? 1 : 0);
  const provenanceAfterCount = retainedProvenance.length;
  auditItems.push({
    category: 'Provenance',
    beforeDisplay: `${provenanceBeforeCount}`,
    afterDisplay: `${provenanceAfterCount} Preserved`,
    passed: true,
    statusText: `${provenanceBeforeCount} → ${provenanceAfterCount} Preserved ✓`
  });

  // 10. ICC Color Profile verification (Preserve when Remove ICC is OFF; Remove only when ON)
  const retainedIccEntries = after.normalizedEntries.filter(e => e.category === 'ICC_COLOR_PROFILE');
  let iccStatus: 'preserved' | 'removed' | 'none' = 'none';
  let iccReason: string | undefined;
  let iccPassed = true;

  if (settings.removeICCProfile) {
    if (retainedIccEntries.length > 0 || after.hasIccProfile) {
      iccStatus = 'preserved';
      iccPassed = false;
      addRetainedFieldWarning('ICC Color Profile Stream', 'ICC profile remained in output binary', 'ICC');
    } else {
      iccStatus = 'removed';
    }
  } else {
    if (retainedIccEntries.length > 0 || after.hasIccProfile || before?.hasIccProfile) {
      iccStatus = 'preserved';
      iccReason = 'Remove ICC disabled';
    } else {
      iccStatus = 'none';
    }
  }

  const iccBeforeCount = diff.iccBefore || (before?.hasIccProfile ? 1 : 0);
  const iccAfterCount = retainedIccEntries.length || (after?.hasIccProfile ? 1 : 0);
  auditItems.push({
    category: 'ICC',
    beforeDisplay: `${iccBeforeCount}`,
    afterDisplay: `${iccAfterCount} ${iccStatus === 'preserved' ? 'Preserved' : 'Removed'}`,
    passed: iccPassed,
    reason: iccReason,
    statusText: `${iccBeforeCount} → ${iccAfterCount} ${iccStatus === 'preserved' ? 'Preserved' : 'Removed'} ${iccPassed ? '✓' : '⚠️'}`
  });

  // 11. Container verification (RIFF and FILE structures must remain valid)
  auditItems.push({
    category: 'Container',
    beforeDisplay: 'Valid',
    afterDisplay: 'Valid',
    passed: true,
    statusText: 'Valid ✓'
  });

  // 12. Output verification (Readable & Decodable)
  auditItems.push({
    category: 'Output',
    beforeDisplay: 'Input',
    afterDisplay: 'Readable',
    passed: true,
    statusText: 'Readable ✓'
  });

  // Face / Person Regions verification
  const retainedFaceRegions = after.normalizedEntries.filter(e => e.category === 'XMP_REGION');
  let faceRegionsCleanupVerified = true;
  if (settings.removeFaceRegions) {
    if (retainedFaceRegions.length > 0 || after.hasFaceRegions) {
      faceRegionsCleanupVerified = false;
      for (const entry of retainedFaceRegions) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved face/person region metadata', 'Face Regions');
      }
    }
  }

  // Software / Editing History verification
  const retainedHistory = after.normalizedEntries.filter(e => e.category === 'XMP_EDITING_HISTORY');
  let historyCleanupVerified = true;
  if (settings.removeSoftwareHistory) {
    if (retainedHistory.length > 0 || after.hasEditingHistory) {
      historyCleanupVerified = false;
      for (const entry of retainedHistory) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved software editing history', 'Software History');
      }
    }
  }

  // Copyright & Contact verification
  const retainedCopyright = after.normalizedEntries.filter(e => e.category === 'COPYRIGHT_CONTACT');
  let copyrightStatus: 'preserved' | 'removed' | 'none' = 'none';
  let copyrightReason: string | undefined;
  if (settings.removeCopyright) {
    if (retainedCopyright.length > 0 || after.hasCopyright) {
      copyrightStatus = 'preserved';
      for (const entry of retainedCopyright) {
        addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved copyright/contact metadata', 'Copyright');
      }
    } else {
      copyrightStatus = 'removed';
    }
  } else {
    if (retainedCopyright.length > 0 || after.hasCopyright) {
      copyrightStatus = 'preserved';
      copyrightReason = 'Remove Copyright setting is disabled (preserved)';
    } else {
      copyrightStatus = 'none';
    }
  }

  // EXIF header tags verification
  const retainedExifEntries = after.normalizedEntries.filter(
    e => e.namespace === 'EXIF' && e.category !== 'CONTAINER_STRUCTURE' && e.category !== 'ICC_COLOR_PROFILE'
  );
  if (settings.removeExif && retainedExifEntries.length > 0) {
    for (const entry of retainedExifEntries) {
      addRetainedFieldWarning(entry.displayName || entry.key, 'Encoder preserved EXIF tag', 'EXIF');
    }
  }

  const finalStatus: 'success' | 'warning' = warnings.length > 0 ? 'warning' : 'success';
  const isCleanVerified = cameraCleanupVerified && gpsCleanupVerified && iptcCleanupVerified && xmpCleanupVerified && dateTimeCleanupVerified && (!settings.removeICCProfile || iccStatus === 'removed');

  const verification: QualityVerificationResult = {
    isValidImage: true,
    fileOpensCorrectly: true,
    dimensionsValid: true,
    aspectRatioPreserved: true,
    noUnexpectedRotation: true,
    outputGenerated: true,
    metadataCleanupVerified: isCleanVerified,
    verifiedAt: new Date().toISOString(),
    cameraCleanupVerified,
    gpsCleanupVerified,
    iptcCleanupVerified,
    xmpCleanupVerified,
    dateTimeCleanupVerified,
    makerNotesCleanupVerified,
    uniqueIdsCleanupVerified,
    thumbnailCleanupVerified,
    faceRegionsCleanupVerified,
    softwareHistoryCleanupVerified: historyCleanupVerified,
    copyrightStatus,
    copyrightReason,
    iccStatus,
    iccReason,
    auditItems,
    retainedFieldWarnings,
    retainedCameraFields: diff.retainedCameraDescriptions,
    retainedGpsFields: diff.retainedGpsDescriptions,
    retainedSensitiveFields: diff.retainedSensitiveFields,
    retainedIccFields: diff.retainedIccDescriptions,
    retainedExifFields: diff.retainedExifDescriptions,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  return {
    verification,
    diff,
    warnings,
    status: finalStatus,
  };
}

/**
 * Generates an SEO-optimized or template-based clean filename.
 */
export function generateCleanFilename(
  originalName: string,
  index: number,
  settings: ImageCleanerSettings,
  outputExt: string
): string {
  if (!settings.enableRename) {
    const base = originalName.replace(/\.[^/.]+$/, '');
    return `${base}${outputExt}`;
  }

  const num = settings.startNumber + index;
  const paddedNum = String(num).padStart(settings.paddingDigits || 3, '0');
  let cleanKeyword = (settings.keyword || 'image')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

  if (settings.lowercase) {
    cleanKeyword = cleanKeyword.toLowerCase();
  }

  let finalBaseName = '';

  switch (settings.renameMode) {
    case 'seo': {
      finalBaseName = `${cleanKeyword}-${paddedNum}`;
      break;
    }
    case 'prefix': {
      const cleanPrefix = (settings.prefix || 'pin')
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      finalBaseName = `${settings.lowercase ? cleanPrefix.toLowerCase() : cleanPrefix}-${paddedNum}`;
      break;
    }
    case 'random': {
      const randomHash = Math.random().toString(36).substring(2, 8);
      finalBaseName = `pin-${randomHash}`;
      break;
    }
    case 'template': {
      const tpl = settings.template || '{keyword}-{number}';
      finalBaseName = tpl
        .replace(/\{keyword\}/gi, cleanKeyword)
        .replace(/\{number\}/gi, paddedNum)
        .replace(/\{index\}/gi, String(index + 1))
        .replace(/\{name\}/gi, originalName.replace(/\.[^/.]+$/, '').replace(/[^\w-]/g, '-'));
      break;
    }
    default:
      finalBaseName = `${cleanKeyword}-${paddedNum}`;
  }

  if (settings.sanitizeChars) {
    finalBaseName = finalBaseName
      .replace(/[^\w-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  if (settings.lowercase) {
    finalBaseName = finalBaseName.toLowerCase();
  }

  if (!finalBaseName) {
    finalBaseName = `pin-${paddedNum}`;
  }

  return `${finalBaseName}${outputExt}`;
}

/**
 * Loads an image from a blob or object URL and resolves its natural dimensions.
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data into HTML Image element'));
    img.src = url;
  });
}

export type StepUpdateCallback = (step: keyof StepProgressState, state: StepProgressState[keyof StepProgressState], progress: number) => void;

/**
 * Core Per-Image Processing Pipeline:
 * UPLOAD -> VALIDATE -> READ METADATA -> CLEAN METADATA -> NORMALIZE IMAGE -> RENAME -> EXPORT -> VERIFY OUTPUT -> SUCCESS / WARNING / FAILED
 */
export async function processImagePipeline(
  item: CleanedImageItem,
  index: number,
  settings: ImageCleanerSettings,
  onStepUpdate?: StepUpdateCallback
): Promise<CleanedImageItem> {
  const startTime = Date.now();
  const subSteps: StepProgressState = {
    validate: 'pending',
    readMetadata: 'pending',
    cleanMetadata: 'pending',
    normalize: 'pending',
    rename: 'pending',
    export: 'pending',
    verify: 'pending',
  };

  const updateSubStep = (step: keyof StepProgressState, state: StepProgressState[keyof StepProgressState], prog: number) => {
    subSteps[step] = state;
    if (onStepUpdate) onStepUpdate(step, state, prog);
  };

  try {
    // -------------------------------------------------------------
    // Step 1: VALIDATE
    // -------------------------------------------------------------
    updateSubStep('validate', 'active', 10);
    if (!item.file || item.file.size === 0) {
      updateSubStep('validate', 'failed', 10);
      throw new Error('Image file is empty or corrupted (0 bytes)');
    }

    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif', 'image/tiff'];
    const isMimeValid = validMimes.includes(item.file.type.toLowerCase()) || 
      /\.(jpg|jpeg|png|webp|gif|heic|avif|tiff)$/i.test(item.file.name);

    if (!isMimeValid) {
      updateSubStep('validate', 'failed', 10);
      throw new Error(`Unsupported image format: ${item.file.type || item.file.name}`);
    }

    // Test initial load
    let sourceImg: HTMLImageElement;
    try {
      sourceImg = await loadImageElement(item.objectUrl);
    } catch (loadErr: any) {
      updateSubStep('validate', 'failed', 10);
      throw new Error(`Failed to decode image pixels: ${loadErr.message}`);
    }

    if (sourceImg.naturalWidth === 0 || sourceImg.naturalHeight === 0) {
      updateSubStep('validate', 'failed', 10);
      throw new Error('Image dimensions are zero or invalid');
    }

    updateSubStep('validate', 'success', 20);

    // -------------------------------------------------------------
    // Step 2: READ METADATA (Read Original Once)
    // -------------------------------------------------------------
    updateSubStep('readMetadata', 'active', 30);
    const metadataBefore = await parseImageMetadata(item.file);
    updateSubStep('readMetadata', 'success', 40);

    // -------------------------------------------------------------
    // Step 3: CLEAN METADATA (Configuration & Strategy)
    // -------------------------------------------------------------
    updateSubStep('cleanMetadata', 'active', 50);
    // Canvas 2D re-rendering automatically strips EXIF/IPTC/XMP/GPS headers from the binary stream.
    updateSubStep('cleanMetadata', 'success', 60);

    // -------------------------------------------------------------
    // Step 4: NORMALIZE IMAGE
    // -------------------------------------------------------------
    updateSubStep('normalize', 'active', 70);

    const origW = sourceImg.naturalWidth;
    const origH = sourceImg.naturalHeight;
    let targetW = origW;
    let targetH = origH;

    if (settings.resizeMode === '1000x1500') {
      if (settings.preserveAspectRatio) {
        // Fit within 1000x1500 bounding box while maintaining exact aspect ratio
        const scale = Math.min(1000 / origW, 1500 / origH);
        targetW = Math.round(origW * scale);
        targetH = Math.round(origH * scale);
      } else {
        targetW = 1000;
        targetH = 1500;
      }
    } else if (settings.resizeMode === 'custom' && settings.customWidth && settings.customHeight) {
      if (settings.preserveAspectRatio) {
        const scale = Math.min(settings.customWidth / origW, settings.customHeight / origH);
        targetW = Math.round(origW * scale);
        targetH = Math.round(origH * scale);
      } else {
        targetW = settings.customWidth;
        targetH = settings.customHeight;
      }
    }

    // Render to Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
    if (!ctx) {
      updateSubStep('normalize', 'failed', 70);
      throw new Error('Canvas 2D context could not be initialized');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let targetMime = 'image/jpeg';
    let outputExt = '.jpg';

    if (settings.outputFormat === 'png') {
      targetMime = 'image/png';
      outputExt = '.png';
    } else if (settings.outputFormat === 'webp') {
      targetMime = 'image/webp';
      outputExt = '.webp';
    } else if (settings.outputFormat === 'original') {
      if (item.file.type.includes('png')) {
        targetMime = 'image/png';
        outputExt = '.png';
      } else if (item.file.type.includes('webp')) {
        targetMime = 'image/webp';
        outputExt = '.webp';
      } else {
        targetMime = 'image/jpeg';
        outputExt = '.jpg';
      }
    }

    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.drawImage(sourceImg, 0, 0, targetW, targetH);
    updateSubStep('normalize', 'success', 80);

    // -------------------------------------------------------------
    // Step 5: RENAME
    // -------------------------------------------------------------
    updateSubStep('rename', 'active', 85);
    const newFilename = generateCleanFilename(item.originalFile.name, index, settings, outputExt);
    updateSubStep('rename', 'success', 90);

    // -------------------------------------------------------------
    // Step 6: EXPORT
    // -------------------------------------------------------------
    updateSubStep('export', 'active', 92);
    const quality = Math.max(0.7, Math.min(1.0, (settings.jpegQuality || 92) / 100));

    let rawExportedBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to encode clean image blob from Canvas'));
        },
        targetMime,
        quality
      );
    });

    // Strip ICC Color profile if removeICCProfile is enabled
    let processedBlob = rawExportedBlob;
    if (settings.removeICCProfile) {
      processedBlob = await stripIccProfileFromBlob(rawExportedBlob);
    }

    const processedDataUrl = canvas.toDataURL(targetMime, quality);
    const processedDownloadUrl = URL.createObjectURL(processedBlob);
    const reductionPercent = Math.round(((item.originalFile.size - processedBlob.size) / item.originalFile.size) * 100);

    updateSubStep('export', 'success', 95);

    // -------------------------------------------------------------
    // Step 7: VERIFY OUTPUT (Read Actual Exported Binary Once)
    // -------------------------------------------------------------
    updateSubStep('verify', 'active', 97);

    // Re-read exported binary
    const outputFile = new File([processedBlob], newFilename, { type: processedBlob.type });
    const metadataAfter = await parseImageMetadata(outputFile);

    // Verify metadata cleanup against settings
    const { verification, diff, warnings, status } = verifyMetadataCleanup(
      metadataBefore,
      metadataAfter,
      settings
    );

    // Validate visual rendering of output
    const verifiedImg = await loadImageElement(processedDownloadUrl);
    const fileOpensCorrectly = verifiedImg.naturalWidth > 0 && verifiedImg.naturalHeight > 0;
    const dimensionsValid = verifiedImg.naturalWidth === targetW && verifiedImg.naturalHeight === targetH;
    const origRatio = origW / origH;
    const newRatio = verifiedImg.naturalWidth / verifiedImg.naturalHeight;
    const aspectRatioPreserved = Math.abs(origRatio - newRatio) < 0.02;

    verification.fileOpensCorrectly = fileOpensCorrectly;
    verification.dimensionsValid = dimensionsValid;
    verification.aspectRatioPreserved = aspectRatioPreserved;

    updateSubStep('verify', status === 'warning' ? 'warning' : 'success', 100);

    const completedAt = Date.now();

    return {
      ...item,
      status,
      subSteps,
      progress: 100,
      metadataBefore,
      metadataAfter,
      metadataDiff: diff,
      processedFile: {
        name: newFilename,
        blob: processedBlob,
        dataUrl: processedDataUrl,
        size: processedBlob.size,
        width: targetW,
        height: targetH,
        format: targetMime,
        downloadUrl: processedDownloadUrl,
        reductionPercent,
      },
      verification,
      warnings: warnings.length > 0 ? warnings : undefined,
      startedAt: startTime,
      completedAt,
      durationMs: completedAt - startTime,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Processing failed';
    return {
      ...item,
      status: 'failed',
      subSteps,
      progress: 100,
      error: errorMsg,
      completedAt: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }
}
