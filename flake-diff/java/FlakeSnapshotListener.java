package com.test.utils;

import org.testng.ITestListener;
import org.testng.ITestResult;
import org.openqa.selenium.WebDriver;

/**
 * Optional TestNG listener - minimal automation (20 lines).
 * Automates snapshot capture so tester doesn't call manually.
 * Keeps manual judgment: which test failed is still human-interpreted in diff.
 *
 * Setup in testng.xml: <listener class-name="com.test.utils.FlakeSnapshotListener"/>
 * Or @Listeners(FlakeSnapshotListener.class)
 * Provide driver via ThreadLocal - adapt to your BaseTest.
 */
public class FlakeSnapshotListener implements ITestListener {

    // Adapt this to your project: how you store WebDriver per thread
    // Example: public static ThreadLocal<WebDriver> DRIVER = BaseTest.driver;
    // For demo, user must set it:
    public static ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();

    @Override
    public void onTestSuccess(ITestResult result) {
        capture(result, "PASS");
    }

    @Override
    public void onTestFailure(ITestResult result) {
        capture(result, "FAIL");
    }

    private void capture(ITestResult result, String status) {
        WebDriver driver = DRIVER.get();
        if (driver == null) return; // no driver, skip silently
        try {
            FlakeSnapshot.capture(driver, result.getMethod().getMethodName(), status);
        } catch (Exception ignored) {
            // Never fail test due to snapshot
        }
    }
}
