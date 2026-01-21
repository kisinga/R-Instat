/**
 * Linked Controls Manager
 *
 * Manages parent-child relationships between controls with reactive behaviors.
 */

import { Injectable, effect } from '@angular/core';
import { ControlBase } from './control-base';

/**
 * Behaviors that can be applied to linked controls
 */
export interface LinkedControlBehaviors {
  addRemoveParameter?: boolean;
  updateFunction?: boolean;
  disabledIfMissing?: boolean;
  hideIfMissing?: boolean;
  changeToDefault?: boolean;
  changeParameterValue?: boolean;
}

/**
 * Configuration for a linked control
 */
export interface LinkedControlConfig<T> {
  control: ControlBase<any>;
  triggerValues: T[];
  behaviors: LinkedControlBehaviors;
}

/**
 * Internal tracking structure
 */
interface LinkedControlEntry<T> {
  parent: ControlBase<T>;
  configs: LinkedControlConfig<T>[];
  effectCleanup?: () => void;
}

/**
 * Service for managing linked control relationships
 */
@Injectable({
  providedIn: 'root',
})
export class LinkedControlsManager {
  private links = new Map<ControlBase<any>, LinkedControlEntry<any>>();

  /**
   * Link child controls to a parent control
   *
   * @param parent - Parent control
   * @param configs - Array of child control configurations
   */
  link<T>(parent: ControlBase<T>, configs: LinkedControlConfig<T>[]): void {
    // Clean up existing link if present
    const existing = this.links.get(parent);
    if (existing?.effectCleanup) {
      existing.effectCleanup();
    }

    // Create effect to react to parent changes
    const effectCleanup = effect(() => {
      const parentValue = parent.value();
      const parentRCode = parent.rCode();
      const parentVisible = true; // Could add visibility tracking if needed

      for (const config of configs) {
        const shouldActivate = config.triggerValues.includes(parentValue) && parentVisible;
        this.applyBehaviors(parent, config, shouldActivate);
      }
    });

    // Store the link
    this.links.set(parent, {
      parent,
      configs,
      effectCleanup,
    });
  }

  /**
   * Unlink controls from a parent
   */
  unlink(parent: ControlBase<any>): void {
    const entry = this.links.get(parent);
    if (entry?.effectCleanup) {
      entry.effectCleanup();
    }
    this.links.delete(parent);
  }

  /**
   * Apply behaviors to a linked control
   */
  private applyBehaviors<T>(
    parent: ControlBase<T>,
    config: LinkedControlConfig<T>,
    activate: boolean
  ): void {
    const { control, behaviors } = config;

    // Update function
    if (behaviors.updateFunction && activate) {
      const parentRCode = parent.rCode();
      if (parentRCode) {
        control.setRCode(parentRCode, false);
      }
    }

    // Change to default state
    if (behaviors.changeToDefault && !activate) {
      // Reset to default when parent condition not met
      // This would need a reset method on ControlBase
    }

    // Add/remove parameter
    if (behaviors.addRemoveParameter) {
      const shouldAdd = activate && control.canAddParameter();
      control.addOrRemoveParameter(shouldAdd);
    }

    // Change parameter value
    if (behaviors.changeParameterValue && activate && behaviors.addRemoveParameter) {
      control.updateToRCode();
    }

    // Hide if missing
    if (behaviors.hideIfMissing) {
      // This would need visibility control - could be handled at component level
      // or we could add a visible signal to ControlBase
    }

    // Disable if missing
    if (behaviors.disabledIfMissing) {
      // Similar to hideIfMissing - would need enabled/disabled state
    }
  }

  /**
   * Cleanup all links (useful for component destruction)
   */
  cleanup(): void {
    for (const entry of this.links.values()) {
      if (entry.effectCleanup) {
        entry.effectCleanup();
      }
    }
    this.links.clear();
  }
}
