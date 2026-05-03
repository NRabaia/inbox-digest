import { test, expect } from '@playwright/test';

test('Settings E2E Flow', async ({ page }) => {
  console.log("Navigating to http://localhost:80/...");
  await page.goto("http://localhost:80/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "01_initial_load.png" });

  // 1) Verify Settings button is visible in header
  console.log("Verifying Settings button...");
  const settingsButton = page.getByRole("button", { name: /Settings/i });
  await expect(settingsButton).toBeVisible({ timeout: 10000 });

  // 2) Click Settings, verify a dialog opens with provider radio options and tabs
  console.log("Clicking Settings...");
  await settingsButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: "02_settings_dialog_open.png" });

  // Verify provider radio options
  console.log("Verifying provider radio options...");
  const providers = ["openai", "azure", "ollama", "windows-copilot"];
  for (const provider of providers) {
    const radio = dialog.locator(`button[role="radio"][value="${provider}"]`);
    await expect(radio).toBeAttached({ timeout: 5000 });
  }

  // Verify tabs
  console.log("Verifying tabs...");
  const tabs = ["OpenAI", "Azure", "Ollama", "Copilot"];
  for (const tabName of tabs) {
    const tab = dialog.getByRole("tab", { name: tabName });
    await expect(tab).toBeVisible({ timeout: 5000 });
  }

  // 3) Switch to Ollama tab, change model to "mistral", click Save, verify dialog closes and badge appears
  console.log("Switching to Ollama tab...");
  await dialog.getByRole("tab", { name: "Ollama" }).click();
  await page.screenshot({ path: "03_ollama_tab.png" });

  console.log("Changing model to 'mistral'...");
  const ollamaTabContent = dialog.locator("[data-state='active']");
  const modelInput = ollamaTabContent.locator("input").nth(1);
  await modelInput.fill("mistral");
  await page.screenshot({ path: "04_mistral_filled.png" });

  console.log("Clicking Save...");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden({ timeout: 10000 });
  
  console.log("Verifying 'AI: ollama' badge...");
  const badge = page.locator("header").getByText("AI: ollama");
  await expect(badge).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "05_ollama_badge_visible.png" });

  // 4) Reopen Settings, switch back to OpenAI, save
  console.log("Reopening Settings...");
  await settingsButton.click();
  await expect(dialog).toBeVisible({ timeout: 10000 });

  console.log("Switching back to OpenAI...");
  await dialog.locator('button[role="radio"][value="openai"]').click();
  await page.screenshot({ path: "06_openai_switched_back.png" });

  console.log("Clicking Save...");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden({ timeout: 10000 });

  const badgeOpenAI = page.locator("header").getByText("AI: openai");
  await expect(badgeOpenAI).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "07_final_state.png" });
});
