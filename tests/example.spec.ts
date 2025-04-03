import { test } from '@playwright/test';

test('example test with debugger', async ({ page }) => {
  // Launch browser in headed mode and pause immediately
  await test.step('Debug test', async () => {
    // Start the debugger
    await page.pause();
    
    // Your test steps here
    await page.goto('https://example.com');
    // More test steps...
  });
}); 