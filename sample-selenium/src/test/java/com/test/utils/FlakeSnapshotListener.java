package com.test.utils;

import org.testng.ITestListener;
import org.testng.ITestResult;
import org.openqa.selenium.WebDriver;

/**
 * Common util — TestNG Listener (separate from test logic)
 * Selenium tests consume via testng.xml <listener>, not via direct FlakeSnapshot calls.
 * Keeps test code clean: DemoFlowTest only does business flow, snapshot is cross-cutting.
 */
public class FlakeSnapshotListener implements ITestListener {

    // ThreadLocal so parallel tests don't clash — set in BaseTest / DemoFlowTest @BeforeMethod
    public static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    @Override
    public void onTestSuccess(ITestResult result) {
        capture(result, "PASS");
    }

    @Override
    public void onTestFailure(ITestResult result) {
        capture(result, "FAIL");
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        capture(result, "SKIP");
    }

    private void capture(ITestResult result, String status) {
        WebDriver driver = DRIVER.get();
        if (driver == null) return;
        try {
            // Uses common util FlakeSnapshot (V2) — single place for schema
            FlakeSnapshot.capture(driver, result.getMethod().getMethodName(), status);
        } catch (Exception ignored) {
            // Never fail test due to snapshot
        }
    }
}
