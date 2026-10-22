import { Pin, AiQueueState, AiStep, AiStatus, PinKeywordDetail, KeywordValidationSummary, AiProviderType } from '../types';
import { dbService } from './db';
import { sanitizeTagList } from './tagsHelper';
import { analyzePinImage, PinAnalyzeResult } from './aiService';
import { validateAndRankKeywords, generateAiKeywordCandidates } from './pinterestTagValidator';

type Listener = (state: AiQueueState) => void;

class AiMetadataEngine {
  private queue: string[] = []; // Pin IDs waiting in queue
  private pinMap: Map<string, Pin> = new Map();
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private shouldStop: boolean = false;
  private currentPinId: string | null = null;
  private currentFilename: string | null = null;
  private currentStep: AiStep = 'idle';
  private currentProvider?: AiProviderType;
  private forcedProvider?: AiProviderType;
  private currentRetryAttempt?: number;
  private processedCount: number = 0;
  private totalCount: number = 0;
  private successCount: number = 0;
  private failedCount: number = 0;
  private language: string = 'English';
  private customPrompt: string = '';
  private minDelaySeconds: number = 1;
  private maxDelaySeconds: number = 1;
  private waitingCountdown: number = 0;
  private cooldownDuration: number = 0;
  private cooldownIntervalId: any = null;
  private skipCooldownResolver: (() => void) | null = null;
  private onPinUpdatedCallback?: (pin: Pin) => void;
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState(): AiQueueState {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentPinId: this.currentPinId,
      currentFilename: this.currentFilename,
      currentStep: this.currentStep,
      currentProvider: this.currentProvider,
      currentRetryAttempt: this.currentRetryAttempt,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      successCount: this.successCount,
      failedCount: this.failedCount,
      waitingCountdown: this.waitingCountdown,
      cooldownDuration: this.cooldownDuration,
      queue: [...this.queue],
    };
  }

  public setDelays(minSeconds: number = 15, maxSeconds: number = 30) {
    this.minDelaySeconds = Math.max(1, minSeconds);
    this.maxDelaySeconds = Math.max(this.minDelaySeconds, maxSeconds);
  }

  public setCustomPrompt(prompt: string) {
    this.customPrompt = prompt || '';
  }

  public setForcedProvider(provider?: AiProviderType) {
    this.forcedProvider = provider;
  }

  public getCustomPrompt(): string {
    return this.customPrompt;
  }

  /**
   * Remove pins from the queue if they are deleted by user
   */
  public removePinsFromQueue(pinIds: string[]) {
    const idSet = new Set(pinIds);
    this.queue = this.queue.filter(id => !idSet.has(id));
    for (const id of pinIds) {
      this.pinMap.delete(id);
    }
    this.totalCount = Math.max(this.processedCount, this.processedCount + this.queue.length + (this.currentPinId ? 1 : 0));
    this.notify();
  }

  /**
   * Start or enqueue pins for sequential AI metadata processing
   */
  public enqueuePins(
    pinsToProcess: Pin[],
    language: string = 'English',
    onPinUpdated?: (pin: Pin) => void,
    minDelay: number = 15,
    maxDelay: number = 30,
    customPrompt?: string
  ) {
    this.language = language;
    if (customPrompt !== undefined) {
      this.customPrompt = customPrompt;
    }
    this.setDelays(minDelay, maxDelay);

    if (onPinUpdated) {
      this.onPinUpdatedCallback = onPinUpdated;
    }

    // Mark pins as 'waiting' in database & UI
    for (const pin of pinsToProcess) {
      const waitingPin: Pin = {
        ...pin,
        aiCustomPrompt: customPrompt !== undefined ? customPrompt : (pin.aiCustomPrompt || this.customPrompt),
        aiStatus: 'waiting',
        aiCurrentStep: 'waiting',
        aiError: null,
        updatedAt: new Date().toISOString(),
      };
      this.pinMap.set(pin.id, waitingPin);
      dbService.savePin(waitingPin).catch(() => {});
      if (this.onPinUpdatedCallback) {
        this.onPinUpdatedCallback(waitingPin);
      }

      if (!this.queue.includes(pin.id) && pin.id !== this.currentPinId) {
        this.queue.push(pin.id);
      }
    }

    if (!this.isRunning) {
      this.totalCount = this.queue.length;
      this.processedCount = 0;
      this.successCount = 0;
      this.failedCount = 0;
      this.shouldStop = false;
      this.isPaused = false;
      this.clearCooldown();
      this.processNext();
    } else {
      this.totalCount = this.processedCount + this.queue.length + (this.currentPinId ? 1 : 0);
      this.notify();
    }
  }

  public pauseQueue() {
    this.isPaused = true;
    this.clearCooldown();
    this.notify();
  }

  public resumeQueue(
    pins: Pin[],
    language?: string,
    onPinUpdated?: (pin: Pin) => void,
    minDelay: number = 15,
    maxDelay: number = 30,
    customPrompt?: string
  ) {
    if (language) this.language = language;
    if (customPrompt !== undefined) this.customPrompt = customPrompt;
    if (onPinUpdated) this.onPinUpdatedCallback = onPinUpdated;
    this.setDelays(minDelay, maxDelay);

    for (const pin of pins) {
      this.pinMap.set(pin.id, pin);
    }

    this.isPaused = false;
    this.shouldStop = false;
    this.notify();

    if (!this.isRunning) {
      this.processNext();
    }
  }

  /**
   * Stop AI Queue immediately
   */
  public stopQueue() {
    this.shouldStop = true;
    this.queue = [];
    this.isRunning = false;
    this.isPaused = false;
    this.currentPinId = null;
    this.currentFilename = null;
    this.currentStep = 'idle';
    this.clearCooldown();
    if (this.skipCooldownResolver) {
      const resolve = this.skipCooldownResolver;
      this.skipCooldownResolver = null;
      resolve();
    }
    this.notify();
  }

  /**
   * Skip current 15s-30s countdown and immediately start next pin
   */
  public skipCooldown() {
    if (this.skipCooldownResolver) {
      this.clearCooldown();
      const resolve = this.skipCooldownResolver;
      this.skipCooldownResolver = null;
      resolve();
    }
  }

  private clearCooldown() {
    if (this.cooldownIntervalId) {
      clearInterval(this.cooldownIntervalId);
      this.cooldownIntervalId = null;
    }
    this.waitingCountdown = 0;
    this.cooldownDuration = 0;
  }

  /**
   * Await 15s to 30s random cooldown delay between bulk pins
   */
  private async waitCooldown(): Promise<void> {
    const min = this.minDelaySeconds || 15;
    const max = this.maxDelaySeconds || 30;
    const duration = Math.floor(Math.random() * (max - min + 1)) + min;

    this.cooldownDuration = duration;
    this.waitingCountdown = duration;
    this.currentStep = 'waiting_cooldown';
    this.notify();

    return new Promise<void>((resolve) => {
      this.skipCooldownResolver = resolve;

      this.cooldownIntervalId = setInterval(() => {
        if (this.shouldStop || this.isPaused) {
          this.clearCooldown();
          resolve();
          return;
        }

        this.waitingCountdown -= 1;
        this.notify();

        if (this.waitingCountdown <= 0) {
          this.clearCooldown();
          this.skipCooldownResolver = null;
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Process a single pin directly with automatic provider selection and fallback
   */
  public async processSinglePin(
    pin: Pin,
    language: string = 'English',
    onPinUpdated?: (pin: Pin) => void,
    customPrompt?: string
  ): Promise<Pin> {
    const callback = onPinUpdated || this.onPinUpdatedCallback;
    console.log(`[AI Analysis] Processing pin "${pin.filename}" (ID: ${pin.id})`);

    // Fetch user AI preferences
    const settings = await dbService.getSettings();
    const activeProvider = this.forcedProvider || settings.aiProvider || 'auto';
    this.currentProvider = activeProvider as AiProviderType;

    const initialProviderLabel = activeProvider === 'groq'
      ? 'Groq AI (Ultra Fast)'
      : activeProvider === 'openrouter'
      ? 'OpenRouter'
      : activeProvider === 'custom'
      ? 'Custom AI'
      : activeProvider === 'gemini' 
      ? 'Gemini' 
      : activeProvider === 'pollinations' 
      ? 'Pollinations' 
      : 'Auto AI';

    const effectiveCustomPrompt = customPrompt !== undefined
      ? customPrompt
      : (pin.aiCustomPrompt || this.customPrompt || settings?.aiCustomPrompt || '');

    // Mark pin as 'analyzing'
    let workingPin: Pin = {
      ...pin,
      aiCustomPrompt: effectiveCustomPrompt,
      aiStatus: 'analyzing',
      aiCurrentStep: 'analyzing',
      aiStatusDetails: `Analyzing image with ${initialProviderLabel}...`,
      aiError: null,
      aiRetryAttempt: 0,
      updatedAt: new Date().toISOString(),
    };
    await dbService.savePin(workingPin);
    if (callback) callback(workingPin);
    this.notify();

    try {
      // Step 1: Vision Analysis directly via frontend AIService (Groq -> OpenRouter -> Gemini -> Pollinations fallback)
      const result = await analyzePinImage(workingPin.imageUrl, {
        filename: workingPin.filename,
        language,
        customPrompt: effectiveCustomPrompt,
        provider: activeProvider,
        groqApiKey: settings?.groqApiKey,
        groqModel: settings?.groqModel,
        openrouterApiKey: settings?.openrouterApiKey,
        openrouterModel: settings?.openrouterModel,
        customApiUrl: settings?.customApiUrl,
        customApiKey: settings?.customApiKey,
        customApiModel: settings?.customApiModel,
        model: activeProvider === 'groq' ? (settings?.groqModel || 'openai/gpt-oss-120b') : activeProvider === 'openrouter' ? (settings?.openrouterModel || 'openrouter/auto') : (settings?.aiModel || 'gemini-3.8-flash'),
        autoRetry: settings?.autoRetry ?? true,
        maxRetries: settings?.maxRetries ?? 3,
        retryDelay: settings?.retryDelay ?? 2000,
        timeout: settings?.timeout ?? 30000,
        onProgress: (step, details) => {
          if (step === 'retrying') {
            workingPin = {
              ...workingPin,
              aiStatus: 'retrying',
              aiStatusDetails: details || 'Retrying...',
              aiRetryAttempt: (workingPin.aiRetryAttempt || 0) + 1,
            };
            if (callback) callback(workingPin);
            this.notify();
          }
        },
      });

      const providerName = result.provider === 'groq'
        ? 'Groq AI'
        : result.provider === 'openrouter'
        ? 'OpenRouter'
        : result.provider === 'custom' 
        ? 'Custom AI' 
        : result.provider === 'pollinations' 
        ? 'Pollinations AI' 
        : 'Gemini';

      // Step 2 & 3: Generate Title, Description, Alt Text, Tags & Destination URL
      workingPin = { 
        ...workingPin, 
        aiCurrentStep: 'generating_title',
        aiStatusDetails: `Crafting Pinterest title (${providerName})...`
      };
      if (callback) callback(workingPin);
      await new Promise(r => setTimeout(r, 60));

      workingPin = { 
        ...workingPin, 
        aiCurrentStep: 'generating_description',
        aiStatusDetails: `Generating traffic-focused description (${providerName})...`
      };
      if (callback) callback(workingPin);
      await new Promise(r => setTimeout(r, 60));

      workingPin = { 
        ...workingPin, 
        aiCurrentStep: 'generating_alt_text',
        aiStatusDetails: `Writing visual accessibility alt text...`
      };
      if (callback) callback(workingPin);
      await new Promise(r => setTimeout(r, 60));

      workingPin = { 
        ...workingPin, 
        aiCurrentStep: 'generating_tags',
        aiStatusDetails: `Validating Pinterest keyword tags & taxonomy...`
      };
      if (callback) callback(workingPin);

      // Validate & Rank Pinterest Keywords
      let finalTags: string[] = [];
      let finalKeywordDetails: PinKeywordDetail[] | undefined = undefined;
      let finalKeywordSummary: KeywordValidationSummary | undefined = undefined;

      if (workingPin.tagsManuallyEdited && workingPin.tags && workingPin.tags.length > 0) {
        finalTags = sanitizeTagList(workingPin.tags);
        finalKeywordDetails = finalTags.map(t => ({
          value: t,
          source: 'manual',
          status: 'validated',
          confidence: 1.0,
          matchReason: 'Manual tag edit (preserved)',
          validatedAt: new Date().toISOString()
        }));
      } else {
        // Collect candidate tags from vision analysis result
        const visionCandidates = Array.isArray(result.tags) ? result.tags : [];
        
        // Generate additional targeted search candidates if needed
        let moreCandidates: string[] = [];
        try {
          moreCandidates = await generateAiKeywordCandidates({
            title: result.title || workingPin.title,
            description: result.description || workingPin.description,
            filename: workingPin.filename,
            altText: result.altText || workingPin.altText,
            existingTags: visionCandidates,
            language,
          });
        } catch {
          // ignore candidate generation failure
        }

        const combinedCandidates = [...visionCandidates, ...moreCandidates];
        const validationResult = await validateAndRankKeywords(combinedCandidates, {
          pinTitle: result.title || workingPin.title,
          pinDescription: result.description || workingPin.description,
          maxLimit: 10,
          allowUnverifiedFallback: true,
        });

        finalTags = validationResult.finalCleanTags;
        finalKeywordDetails = validationResult.validatedKeywords;
        finalKeywordSummary = validationResult.summary;
      }

      // Apply metadata, respecting manually edited overrides
      const newTitle = workingPin.titleManuallyEdited && workingPin.title.trim()
        ? workingPin.title
        : result.title || workingPin.title || workingPin.filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      const newDescription = workingPin.descriptionManuallyEdited && workingPin.description.trim()
        ? workingPin.description
        : result.description || workingPin.description;

      const newAltText = workingPin.altTextManuallyEdited && workingPin.altText?.trim()
        ? workingPin.altText
        : result.altText || workingPin.altText || '';

      const newTags = finalTags;

      // Apply suggested destination URL if current is empty
      const newDestinationUrl = (!workingPin.destinationUrl && result.url)
        ? result.url
        : workingPin.destinationUrl;

      // Step 4: Save Result (Success)
      const now = new Date().toISOString();
      const updatedPin: Pin = {
        ...workingPin,
        title: newTitle,
        description: newDescription,
        altText: newAltText,
        tags: newTags,
        keywordDetails: finalKeywordDetails,
        keywordSummary: finalKeywordSummary,
        destinationUrl: newDestinationUrl,
        aiStatus: 'success',
        aiGenerated: true,
        aiProviderUsed: result.provider || (activeProvider === 'pollinations' ? 'pollinations' : 'gemini'),
        aiStatusDetails: result.fallbackUsed ? 'Generated via Pollinations (Fallback)' : `Generated via ${providerName}`,
        aiError: null,
        aiProcessedAt: now,
        aiCurrentStep: 'completed',
        aiRetryAttempt: result.attempts || 1,
        updatedAt: now,
      };

      console.log(`[AI Analysis] AI analysis completed for "${pin.filename}" via ${updatedPin.aiProviderUsed}:`, {
        title: updatedPin.title,
        tagsCount: updatedPin.tags?.length,
        fallbackUsed: result.fallbackUsed,
      });

      await dbService.savePin(updatedPin);
      if (callback) callback(updatedPin);
      return updatedPin;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[AI Analysis] Pin "${pin.filename}" failed:`, errMsg);

      const errorPin: Pin = {
        ...workingPin,
        aiStatus: 'failed',
        aiError: errMsg || 'AI analysis failed across all providers',
        aiStatusDetails: `Analysis failed: ${errMsg.slice(0, 50)}`,
        aiCurrentStep: 'failed',
        updatedAt: new Date().toISOString(),
      };
      await dbService.savePin(errorPin);
      if (callback) callback(errorPin);
      return errorPin;
    }
  }

  /**
   * Main sequential queue processing loop - exactly ONE pin at a time with 15s-30s pacing
   * CRITICAL FOR MASS UPLOAD: If one pin fails, the queue NEVER stops and continues to the rest!
   */
  private async processNext() {
    if (this.shouldStop) {
      this.isRunning = false;
      this.currentPinId = null;
      this.currentFilename = null;
      this.currentStep = 'idle';
      this.clearCooldown();
      this.notify();
      return;
    }

    if (this.isPaused) {
      this.isRunning = false;
      this.currentStep = 'idle';
      this.clearCooldown();
      this.notify();
      return;
    }

    if (this.queue.length === 0) {
      this.isRunning = false;
      this.currentPinId = null;
      this.currentFilename = null;
      this.currentStep = 'idle';
      this.clearCooldown();
      this.notify();
      return;
    }

    this.isRunning = true;
    const nextPinId = this.queue.shift()!;
    this.currentPinId = nextPinId;

    let pin = this.pinMap.get(nextPinId);
    if (!pin) {
      pin = await dbService.getPin(nextPinId);
    }

    if (!pin) {
      this.processedCount++;
      this.notify();
      this.processNext();
      return;
    }

    this.currentFilename = pin.filename;
    this.currentStep = 'analyzing';
    this.notify();

    try {
      const updatedPin = await this.processSinglePin(
        pin, 
        this.language, 
        this.onPinUpdatedCallback, 
        pin.aiCustomPrompt || this.customPrompt
      );
      if (updatedPin.aiStatus === 'success' || updatedPin.aiStatus === 'completed') {
        this.successCount++;
      } else {
        this.failedCount++;
      }
    } catch (err: any) {
      console.error(`[AI Analysis] Uncaught error during pin processing:`, err);
      this.failedCount++;
    } finally {
      this.processedCount++;
      this.currentPinId = null;
      this.currentFilename = null;
      this.notify();

      if (this.shouldStop) {
        this.isRunning = false;
        this.currentStep = 'idle';
        this.clearCooldown();
        this.notify();
        return;
      }

      // If more pins remain in queue, wait cooldown and proceed to next pin unconditionally!
      if (this.queue.length > 0 && !this.shouldStop && !this.isPaused) {
        await this.waitCooldown();
      }

      // Continue processing the rest of the queue
      this.processNext();
    }
  }
}

export const aiMetadataQueue = new AiMetadataEngine();
