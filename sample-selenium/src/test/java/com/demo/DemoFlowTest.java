package com.demo;

import com.test.utils.FlakeSnapshotListener;
import io.github.bonigarcia.wdm.WebDriverManager;
import io.qameta.allure.Step;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.testng.Assert;
import org.testng.annotations.*;
import java.io.File;
import java.time.Duration;

/**
 * Production-grade demo flow — headless-capable, no Thread.sleep, deterministic.
 * Run headed locally: mvn test -Dheadless=false
 * Run headless CI:    mvn test -Dheadless=true
 */
public class DemoFlowTest {
    WebDriver driver;
    WebDriverWait wait;
    String demoUrl;

    @BeforeSuite
    void setupDriverManager(){ WebDriverManager.chromedriver().setup(); }

    @BeforeMethod
    void setUp(){
        ChromeOptions opts = new ChromeOptions();
        boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));
        if(headless) opts.addArguments("--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage");
        opts.addArguments("--window-size=1280,800","--allow-file-access-from-files");
        driver = new ChromeDriver(opts);
        wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        FlakeSnapshotListener.DRIVER.set(driver);
        demoUrl = resolveDemoUrl(false);
    }

    @AfterMethod(alwaysRun = true)
    void tearDown(){
        FlakeSnapshotListener.DRIVER.remove();
        if(driver!=null) driver.quit();
    }

    @Test
    void testPass(){
        driver.get(demoUrl);
        doFlow();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='btn-pay']")));
        boolean payVisible = driver.findElement(By.cssSelector("[data-testid='btn-pay']")).isDisplayed();
        Assert.assertTrue(payVisible, "btn-pay should be visible in PASS");
    }

    @Test
    void testFail_Flaky(){
        String flakeUrl = resolveDemoUrl(true);
        driver.get(flakeUrl);
        doFlow();
        // In flake mode btn-pay is removed from DOM — expect not visible
        boolean payVisible = driver.findElements(By.cssSelector("[data-testid='btn-pay']")).size()>0
                && driver.findElements(By.cssSelector("[data-testid='btn-pay']")).get(0).isDisplayed();
        Assert.assertTrue(payVisible, "btn-pay should be visible but flake hides it — expect FAIL");
    }

    @Step("Demo flow: login -> products -> checkout")
    void doFlow(){
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='input-username']")));
        driver.findElement(By.cssSelector("[data-testid='input-username']")).sendKeys("tester");
        driver.findElement(By.cssSelector("[data-testid='input-password']")).sendKeys("pass");
        driver.findElement(By.cssSelector("[data-testid='btn-login']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='btn-add-1']")));
        driver.findElement(By.cssSelector("[data-testid='btn-add-1']")).click();
        driver.findElement(By.cssSelector("[data-testid='btn-go-checkout']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='checkout-body']")));
    }

    String resolveDemoUrl(boolean flake){
        // Single canonical resolver: sample-selenium is sibling to demo-app
        File base = new File(System.getProperty("user.dir"));
        File candidate = new File(base, "../demo-app/index.html");
        if(!candidate.exists()) candidate = new File(base, "demo-app/index.html");
        if(!candidate.exists()) candidate = new File("../demo-app/index.html");
        if(!candidate.exists()) throw new RuntimeException("demo-app/index.html not found from " + base.getAbsolutePath());
        String url = candidate.getAbsoluteFile().toURI().toString();
        if(flake) url += (url.contains("?") ? "&" : "?") + "flake=1";
        return url;
    }
}
