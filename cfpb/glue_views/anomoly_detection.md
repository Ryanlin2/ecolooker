# What This SQL Is Doing, Mathematically

This is a **rolling z-score anomaly detector**. Let me break it into the mathematical pieces.

## Step 1: Counting — building a time series

```sql
daily AS (SELECT day_received, product, issue, COUNT(*) ...)
```

For every combination of (day, product, issue), you're computing:

$$
X_{t} = \text{count of complaints on day } t \text{ for a given (product, issue)}
$$

This turns raw complaint rows into a **discrete time series** $X_t$, one series per (product, issue) pair. Everything downstream operates independently within each of these series (that's what `PARTITION BY product, issue` will enforce).

## Step 2: The rolling window — defining "normal"

```sql
ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING
```

For a given day $t$, define the **trailing window** of the previous 28 days (excluding today):

$$
W_t = \{X_{t-28}, X_{t-27}, \dots, X_{t-1}\}
$$

Note today's value $X_t$ is deliberately *excluded* — you don't want today's spike contaminating the baseline you're comparing it against. This is a classic **out-of-sample baseline**.

## Step 3: Baseline mean and standard deviation

$$
\mu_t = \text{baseline\_avg} = \frac{1}{|W_t|}\sum_{i \in W_t} X_i
$$

$$
\sigma_t = \text{baseline\_std} = \sqrt{\frac{1}{|W_t|}\sum_{i \in W_t} (X_i - \mu_t)^2}
$$

Note `STDDEV_POP` is the **population** standard deviation (divides by $n$), not the sample standard deviation (which divides by $n-1$). So this treats the 28 trailing days as the entire population of interest, not a sample estimating some larger population — a defensible choice here since you're not trying to infer a "true" universal rate, just describing recent local behavior.

Both $\mu_t$ and $\sigma_t$ are **time-varying** — they slide forward one day at a time, so the "baseline" adapts as it moves through the series. This is why it's called a *rolling* or *moving* statistic, as opposed to a single global mean/std computed once over the whole dataset.

## Step 4: The z-score — standardizing today's value

$$
z_t = \frac{X_t - \mu_t}{\sigma_t}
$$

This answers: **"how many standard deviations away from the recent baseline is today's count?"**

This is the same transformation used to convert any raw observation into a **standard score**, assuming (approximately) that $X_t$ behaves like a value drawn from a distribution with mean $\mu_t$ and spread $\sigma_t$. If complaint counts were exactly normally distributed conditional on the baseline, $z_t$ would follow a standard normal distribution $N(0,1)$, but the code doesn't assume that formally — it just uses $z$ as a scale-free measure of "unusualness."

The `CASE WHEN baseline_std > 0` guards against division by zero: if the last 28 days had zero variance (e.g., always exactly 2 complaints/day, or all zeros), $\sigma_t = 0$ and $z_t$ is undefined — so it's returned as `NULL` instead of causing an error.

## Step 5: Anomaly flag — thresholding

$$
\text{is\_anomaly} = \left(\sigma_t > 0\right) \wedge \left(|z_t| \geq 3\right)
$$

This flags a day as anomalous if today's count is **3 or more standard deviations** from the trailing 28-day mean.

### Why 3?

This borrows from the **empirical rule** (68–95–99.7 rule) for roughly normal distributions:

| Range | Approx. % of data contained |
|---|---|
| $\mu \pm 1\sigma$ | ~68% |
| $\mu \pm 2\sigma$ | ~95% |
| $\mu \pm 3\sigma$ | ~99.7% |

So under a normality assumption, only about **0.3%** of "normal" days should fall outside $\pm 3\sigma$ — making it a conservative, low-false-positive threshold. In practice, complaint counts are more like a **Poisson or overdispersed count process**, not perfectly Gaussian, so the true false-positive rate will differ from 0.3% — but $3\sigma$ is still a widely used, simple convention for "this is unusual enough to flag."

## Putting it together conceptually

For each (product, issue) series, at each day $t$:

1. Look at the **trailing 28-day window** (excluding today).
2. Compute its **mean** $\mu_t$ and **population std dev** $\sigma_t$ — this is the "expected normal behavior."
3. Compute how far today's actual count deviates, in **standardized units**: $z_t$.
4. Flag as anomalous if $|z_t| \ge 3$ — i.e., today is a statistical outlier relative to its own recent history.

This is essentially a lightweight, **adaptive control-chart** method (very close in spirit to Shewhart control charts / Statistical Process Control), where the "control limits" are $\mu_t \pm 3\sigma_t$, recomputed fresh every day from the most recent 28-day history rather than fixed once and for all.