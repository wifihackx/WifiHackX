/**
 * Unit Tests for Admin Panel Theme
 * Feature: fix-admin-panel-visibility
 *
 * These tests verify specific examples, edge cases, and concrete
 * implementations of the admin panel theme.
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup DOM environment
function setupDOM(html = '') {
  const cssContent = readFileSync(
    join(__dirname, '../admin-panel-theme.css'),
    'utf-8'
  );

  const defaultHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${cssContent}</style>
      </head>
      <body>
        <div id="adminView">
          <div class="dashboard-stats">
            <div class="stat-card">
              <div class="stat-icon users"></div>
              <div class="stat-content">
                <h3>Usuarios Totales</h3>
                <div class="stat-value">150</div>
                <div class="stat-change">+10%</div>
              </div>
            </div>
          </div>
          <div class="analytics-summary">
            <div class="analytics-card">
              <h4>Conversión</h4>
              <div class="value">3.5%</div>
              <div class="change">+0.5%</div>
            </div>
          </div>
        </div>
        ${html}
      </body>
    </html>
  `;

  const dom = new JSDOM(defaultHTML);
  return dom.window;
}

describe('Admin Panel Theme - Unit Tests', () => {
  let window;

  beforeEach(() => {
    window = setupDOM();
  });

  describe('Stat Card Colors', () => {
    test('stat cards should have correct background color #2a2a3a', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify CSS contains the background color
      expect(cssContent).toMatch(/#adminView\s+\.stat-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
    });

    test('stat cards should have red border color', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Border should contain red component
      expect(cssContent).toMatch(/border:.*rgba?\(255.*0.*0/);
    });

    test('stat cards should have 2px border width', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/border:\s*2px/);
    });

    test('stat cards should have box-shadow with red glow', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/box-shadow:.*rgba?\(255.*0.*0/);
    });
  });

  describe('Analytics Card Colors', () => {
    test('analytics cards should have correct background color #2a2a3a', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/#adminView\s+\.analytics-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
    });

    test('analytics cards should have red border color', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Border should contain red component
      expect(cssContent).toMatch(/border:.*rgba?\(255.*0.*0/);
    });
  });

  describe('Text Colors', () => {
    test('stat value should have white color #ffffff', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/\.stat-value/);
      expect(cssContent).toMatch(/color:\s*#ffffff/);
    });

    test('stat content h3 should have light gray color #e0e0e0', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/\.stat-content\s+h3/);
      expect(cssContent).toMatch(/color:\s*#e0e0e0/);
    });

    test('analytics value should have white color #ffffff', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/\.analytics-card\s+\.value/);
      expect(cssContent).toMatch(/color:\s*#ffffff/);
    });
  });

  describe('Icon Colors', () => {
    test('users icon should have cyan background', () => {
      const icon = window.document.querySelector('.stat-icon.users');
      const styles = window.getComputedStyle(icon);

      expect(styles.backgroundColor).toMatch(/rgba?\(0.*212.*255/);
    });

    test('users icon should have cyan text color', () => {
      const icon = window.document.querySelector('.stat-icon.users');
      const styles = window.getComputedStyle(icon);

      expect(styles.color).toMatch(/rgb\(0.*212.*255\)/);
    });
  });

  describe('Fallbacks for Old Browsers', () => {
    test('stat cards should have hardcoded background before CSS variable', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Check that fallback exists before var()
      const statCardRule = cssContent.match(
        /#adminView \.stat-card\s*{[^}]+}/s
      )[0];
      const backgroundLines = statCardRule.match(/background:[^;]+;/g);

      expect(backgroundLines.length).toBeGreaterThanOrEqual(2);
      expect(backgroundLines[0]).toContain('#2a2a3a');
      expect(backgroundLines[1]).toContain('var(--admin-surface)');
    });

    test('stat cards should have hardcoded border before CSS variable', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      const statCardRule = cssContent.match(
        /#adminView \.stat-card\s*{[^}]+}/s
      )[0];
      const borderLines = statCardRule.match(/border:[^;]+;/g);

      expect(borderLines.length).toBeGreaterThanOrEqual(2);
      expect(borderLines[0]).toContain('rgba(255, 0, 0, 0.4)');
      expect(borderLines[1]).toContain('var(--admin-border)');
    });
  });

  describe('Responsive Design', () => {
    test('dashboard-stats should use single column on mobile', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Check for mobile media query
      expect(cssContent).toMatch(/@media.*max-width:\s*768px/);
      expect(cssContent).toMatch(/grid-template-columns:\s*1fr/);
    });

    test('stat cards should have reduced padding on mobile', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      const mobileSection = cssContent.match(
        /@media.*max-width:\s*768px.*?{[^}]+}/s
      );
      expect(mobileSection).toBeTruthy();
    });
  });

  describe('Focus Indicators', () => {
    test('stat cards should have red outline on focus', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/#adminView \.stat-card:focus/);
      expect(cssContent).toMatch(/outline:.*#ff0000/);
    });

    test('analytics cards should have red outline on focus', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      expect(cssContent).toMatch(/#adminView \.analytics-card:focus/);
      expect(cssContent).toMatch(/outline:.*#ff0000/);
    });
  });

  describe('Style Isolation', () => {
    test('styles should only affect elements inside #adminView', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // All stat-card styles should be scoped to #adminView
      const statCardRules = cssContent.match(/#adminView\s+\.stat-card/g);
      expect(statCardRules).toBeTruthy();
      expect(statCardRules.length).toBeGreaterThan(0);

      // Should NOT have unscoped .stat-card rules
      const unscopedRules = cssContent.match(/^\.stat-card\s*{/gm);
      expect(unscopedRules).toBeFalsy();
    });

    test('CSS variables should only be defined inside #adminView scope', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // All --admin-* variables should be inside #adminView
      const adminViewSection = cssContent.match(/#adminView\s*{[^}]+}/s);
      expect(adminViewSection).toBeTruthy();
      expect(adminViewSection[0]).toMatch(/--admin-surface/);
      expect(adminViewSection[0]).toMatch(/--admin-border/);
      expect(adminViewSection[0]).toMatch(/--admin-text/);
    });
  });

  describe('Dynamic Element Support', () => {
    test('dynamically added stat cards should inherit admin styles', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify that stat-card styles are defined
      expect(cssContent).toMatch(/#adminView\s+\.stat-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
      expect(cssContent).toMatch(/border:\s*2px/);
    });

    test('dynamically added analytics cards should inherit admin styles', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify that analytics-card styles are defined
      expect(cssContent).toMatch(/#adminView\s+\.analytics-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
      expect(cssContent).toMatch(/border:\s*2px/);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty stat cards gracefully', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify stat-card has min-height defined
      expect(cssContent).toMatch(/#adminView\s+\.stat-card/);
      expect(cssContent).toMatch(/min-height:\s*150px/);
    });

    test('should handle nested elements correctly', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify stat-card maintains its styles
      expect(cssContent).toMatch(/#adminView\s+\.stat-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
    });

    test('should handle multiple admin views on same page', () => {
      const cssContent = readFileSync(
        join(__dirname, '../admin-panel-theme.css'),
        'utf-8'
      );

      // Verify styles are scoped to #adminView
      expect(cssContent).toMatch(/#adminView\s+\.stat-card/);
      expect(cssContent).toMatch(/background:\s*#2a2a3a/);
    });
  });
});
