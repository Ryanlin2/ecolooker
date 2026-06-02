# IMF DataMapper Indicators Cheatsheet

Source endpoint: `https://www.imf.org/external/datamapper/api/v2/indicators`

Use an indicator code like this:

```python
url = f"https://www.imf.org/external/datamapper/api/v2/{indicator}"
```

## World Economic Outlook (`WEO`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `NGDP_RPCH` | Real GDP growth | Annual percent change | Real output growth; use for headline economic growth comparisons. |
| `NGDPD` | GDP, current prices | Billions of U.S. dollars | Nominal GDP in USD; useful for ranking economy size at market exchange rates. |
| `NGDPDPC` | GDP per capita, current prices | U.S. dollars per capita | Nominal GDP per person in USD; useful for income-level comparisons. |
| `PPPGDP` | GDP, current prices | PPP; billions of international dollars | GDP adjusted for purchasing power parity; better for real economy-size comparisons. |
| `PPPPC` | GDP per capita, current prices | PPP; international dollars per capita | PPP-adjusted GDP per person; useful for living-standard comparisons. |
| `PPPSH` | GDP based on PPP, share of world | Percent of World | Country share of world output using PPP weights. |
| `PPPEX` | Implied PPP conversion rate | National currency per international dollar | PPP exchange/conversion rate implied by relative prices. |
| `PCPIPCH` | Inflation rate, average consumer prices | Annual percent change | Average CPI inflation across the year. |
| `PCPIEPCH` | Inflation rate, end-of-period consumer prices | Annual percent change | CPI inflation measured at year-end. |
| `LP` | Population | Millions of people | Total population. |
| `BCA` | Current account balance, U.S. dollars | Billions of U.S. dollars | External current-account balance in USD. |
| `BCA_NGDPD` | Current account balance, percent of GDP | Percent of GDP | Current-account balance scaled by GDP; useful for external imbalance analysis. |
| `LUR` | Unemployment rate | Percent | Unemployed persons as a share of the labor force. |
| `GGXCNL_NGDP` | General government net lending/borrowing | Percent of GDP | Overall fiscal balance; surplus if positive, deficit if negative. |
| `GGXWDG_NGDP` | General government gross debt | Percent of GDP | General government gross debt burden. |

## Public Finances in Modern History (`FPP`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `rev` | Government revenue, percent of GDP | % of GDP | Government revenue ratio. |
| `exp` | Government expenditure, percent of GDP | % of GDP | Government spending ratio. |
| `prim_exp` | Government primary expenditure, percent of GDP | % of GDP | Government spending excluding interest payments. |
| `ie` | Interest paid on public debt, percent of GDP | % of GDP | Interest burden on public debt. |
| `pb` | Government primary balance, percent of GDP | % of GDP | Fiscal balance before interest payments. |
| `d` | Gross public debt, percent of GDP | % of GDP | Public debt burden. |
| `rgc` | Real GDP growth rate, percent | Percent | Real GDP growth series used in public-finance history. |
| `rltir` | Real long-term government bond yield, percent | Percent | Inflation-adjusted long-term government borrowing yield. |

## Structural Transformation / Diversification (`SPRLU`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `extensive` | Extensive Margin | Index | Export diversification from adding new products/markets. |
| `intensive` | Intensive Margin | Index | Export diversification from spreading exports across existing products/markets. |
| `total_theil` | Export Diversification Index | Index | Overall export diversification measured by a Theil index. |
| `SITC1_0` | Food and live animals | Index | Export quality index for SITC category 0. |
| `SITC1_1` | Beverages and tobacco | Index | Export quality index for SITC category 1. |
| `SITC1_2` | Crude materials, inedible, except fuels | Index | Export quality index for SITC category 2. |
| `SITC1_3` | Mineral fuels, lubricants and related materials | Index | Export quality index for SITC category 3. |
| `SITC1_4` | Animal and vegetable oils and fats | Index | Export quality index for SITC category 4. |
| `SITC1_5` | Chemicals | Index | Export quality index for SITC category 5. |
| `SITC1_6` | Manufactured goods classified chiefly by material | Index | Export quality index for SITC category 6. |
| `SITC1_7` | Machinery and transport equipment | Index | Export quality index for SITC category 7. |
| `SITC1_8` | Miscellaneous manufactured articles | Index | Export quality index for SITC category 8. |
| `SITC1_9` | Commodities and transactions not classified by kind | Index | Export quality index for SITC category 9. |
| `SITC1_total` | Export Quality Index | Index | Overall export quality index. |

## Capital Flows in Developing Economies (`CF`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `DirectAbroad` | Direct Investment Abroad | Millions of US Dollars | Resident outward direct investment. |
| `DirectIn` | Direct Investment In Country | Millions of US Dollars | Nonresident direct investment into the country. |
| `PrivInexDI` | Private Inflows excluding Direct Investment | Millions of US Dollars | Private capital inflows excluding FDI. |
| `PrivInexDIGDP` | Private Inflows excluding Direct Investment (% of GDP) | Percent | Private non-FDI inflows scaled by GDP. |
| `PrivOutexDI` | Private Outflows excluding Direct Investment | Millions of US Dollars | Private capital outflows excluding FDI. |
| `PrivOutexDIGDP` | Private Outflows excluding Direct Investment (% of GDP) | Percent | Private non-FDI outflows scaled by GDP. |
| `Portfa` | Portfolio Investment Assets | Millions of US Dollars | Resident holdings of foreign portfolio assets. |
| `Portfl` | Portfolio Investment Liabilities | Millions of US Dollars | Nonresident holdings of domestic portfolio liabilities. |
| `EquityA` | Equity Securities Assets | Millions of US Dollars | Resident foreign equity security assets. |
| `EquityL` | Equity Securities Liabilities | Millions of US Dollars | Nonresident domestic equity security liabilities. |
| `DebtA` | Debt Securities Assets | Millions of US Dollars | Resident holdings of foreign debt securities. |
| `DebtL` | Debt Securities Liabilities | Millions of US Dollars | Nonresident holdings of domestic debt securities. |
| `OtherGov` | Proxy for Official Other Investment Liabilities | Millions of US Dollars | Proxy for official-sector other investment liabilities. |
| `OtherA` | Other Investment Assets | Millions of US Dollars | Other external investment assets. |
| `OtherL` | Other Investment Liabilities | Millions of US Dollars | Other external investment liabilities. |
| `Deriv` | Financial Derivatives | Millions of US Dollars | Financial derivatives position/flow measure. |
| `DebtForg` | Debt Forgiveness | Millions of US Dollars | Debt relief or forgiveness amount. |
| `GDP` | Nominal GDP | Millions of US Dollars | Nominal GDP used in the capital-flows dataset. |

## Capital Liberalization / Openness (`CL`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `ka_new` | Overall Openness Index | Units | Overall capital-account openness, 0 to 1 where 1 is fully liberalized. |
| `ka_in` | Openness of Capital Inflows Index | Units | Openness to capital inflows. |
| `ka_out` | Openness of Capital Outflows Index | Units | Openness to capital outflows. |
| `FM_ka` | Financial Market Openness Index | Units | Openness across equity, bond, money market, collective investment, and derivatives. |
| `Nonres_ka` | Nonresident Openness Index | Units | Openness for nonresident financial transactions. |
| `Res_ka` | Resident Openness Index | Units | Openness for resident cross-border financial transactions. |
| `Ka_eq` | Equity openness index | Units | Openness for equity securities transactions. |
| `Ka_bo` | Bond openness index | Units | Openness for longer-maturity bond transactions. |
| `Ka_mm` | Money market openness index | Units | Openness for short-term money-market instruments. |
| `Ka_ci` | Collective investment openness index | Units | Openness for mutual funds, investment trusts, and similar vehicles. |
| `Ka_dr` | Derivative investment openness index | Units | Openness for derivatives, options, futures, swaps, and FX operations. |
| `Ka_cc` | Commercial credit openness index | Units | Openness for trade-linked commercial credit. |
| `Ka_fc` | Financial credit openness index | Units | Openness for cross-border financial credit. |
| `Ka_gu` | Guarantee openness index | Units | Openness for guarantees and financial backup facilities. |
| `Ka_di` | Direct investment openness index | Units | Openness for inward and outward direct investment. |
| `ka_ldi` | Direct investment liquidation openness index | Units | Ability to transfer principal/capital gains from FDI. |
| `ka_ret` | Real estate capital transaction openness index | Units | Openness for cross-border real-estate capital transactions. |
| `ka_pct` | Personal capital transaction openness index | Units | Openness for personal transfers, gifts, inheritances, migrant assets, and related transactions. |

## Assessing Reserve Adequacy (`ARA`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `Reserves_ARA` | Ratio of reserves / ARA metric | Unit | Reserve adequacy against the IMF ARA metric; 1 to 1.5 is often treated as adequate. |
| `Reserves_M2` | Reserves / Broad Money | Unit | Reserves relative to broad money, typically M2. |
| `Reserves_STD` | Reserves / Short-term Debt | Unit | Reserves relative to short-term debt; linked to the Greenspan-Guidotti rule. |
| `Reserves_M` | Reserves / monthly imports | Unit | Import-cover measure: months of imports covered by reserves. |

## Gender Data (`GD`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `GRB_dummy` | Gender Budgeting Indicator | Index | Categorical indicator for gender budgeting status. |
| `GDI_TC` | Gender Development Index, time consistent | Index | Equality-oriented development index; higher values imply more equality. |
| `GII_TC` | Gender Inequality Index, time consistent | Index | Inequality index; higher values imply more inequality. |

## Fiscal Affairs Departmental Data (`DEBT`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `DEBT1` | DEBT | % of GDP | Debt measure; country-group values use medians. |

## Global Debt Database (`GDD`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `Privatedebt_all` | Private debt, all instruments | Percent of GDP | Total household and nonfinancial corporate debt across all debt instruments. |
| `HH_ALL` | Household debt, all instruments | Percent of GDP | Total household debt across all debt instruments. |
| `NFC_ALL` | Nonfinancial corporate debt, all instruments | Percent of GDP | Total nonfinancial corporate debt across all debt instruments. |
| `PVD_LS` | Private debt, loans and debt securities | Percent of GDP | Household plus nonfinancial corporate loans and debt securities. |
| `HH_LS` | Household debt, loans and debt securities | Percent of GDP | Household loans and debt securities. |
| `NFC_LS` | Nonfinancial corporate debt, loans and debt securities | Percent of GDP | Nonfinancial corporate loans and debt securities. |
| `PS_DEBT_GDP` | Public Sector Debt | Percent of GDP | Debt liabilities of the public sector. |
| `NFPS_DEBT_GDP` | Nonfinancial Public Sector Debt | Percent of GDP | Debt liabilities of the nonfinancial public sector. |
| `GG_DEBT_GDP` | General Government Debt | Percent of GDP | Debt liabilities of the general government. |
| `CG_DEBT_GDP` | Central Government Debt | Percent of GDP | Debt liabilities of the central government. |

## Fiscal Monitor (`FM`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `GGXCNL_G01_GDP_PT` | Net lending/borrowing / overall balance | % of GDP | Overall fiscal balance under GFSM methodology. |
| `GGXONLB_G01_GDP_PT` | Primary net lending/borrowing / primary balance | % of GDP | Overall balance excluding net interest payments. |
| `GGCB_G01_PGDP_PT` | Cyclically adjusted balance | % of potential GDP | Fiscal balance adjusted for the economic cycle. |
| `GGCBP_G01_PGDP_PT` | Cyclically adjusted primary balance | % of potential GDP | Cyclically adjusted balance excluding net interest payments. |
| `GGR_G01_GDP_PT` | Revenue | % of GDP | General government revenue. |
| `G_X_G01_GDP_PT` | Expenditure | % of GDP | General government expenditure. |
| `G_XWDG_G01_GDP_PT` | Gross debt position | % of GDP | Gross general-government debt position. |
| `GGXWDN_G01_GDP_PT` | Net debt | % of GDP | Gross debt minus qualifying financial assets. |

## AFR Regional Economic Outlook (`AFRREO`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `NGDP_R_PCH` | Real GDP Growth | Annual percent change | Real GDP growth for African Regional Economic Outlook countries/groups. |
| `NGDPXO_RPCH` | Real Non-Oil GDP Growth | Annual percent change | Real GDP growth excluding oil activity. |
| `NGDPRPC_PCH` | Real Per Capita GDP Growth | Annual percent change | Real GDP per capita growth. |
| `NI_GDP` | Total Investment (% of GDP) | Percent of GDP | Total investment share of GDP. |
| `NGS_GDP` | Gross National Savings (% of GDP) | Percent of GDP | Gross national savings share of GDP. |
| `GGXCNL_GDP` | Overall Fiscal Balance, Including Grants (% of GDP) | Percent of GDP | Fiscal balance including grants. |
| `GGXCNLXG_GDP` | Overall Fiscal Balance, Excluding Grants (% of GDP) | Percent of GDP | Fiscal balance excluding grants. |
| `GGRXG_GDP` | Government Revenue, Excluding Grants (% of GDP) | Percent of GDP | Government revenue excluding grants. |
| `GGX_GDP` | Government Expenditure (% of GDP) | Percent of GDP | Government expenditure share of GDP. |
| `GGXWDG_GDP` | Government Debt (% of GDP) | Percent of GDP | Government debt share of GDP. |
| `FMB_GDP` | Broad Money (% of GDP) | Percent of GDP | Broad money stock relative to GDP. |
| `FDSAOP_PCH` | Claims on Nonfinancial Private Sector (%) | Annual percent change | Growth in claims on the nonfinancial private sector. |
| `FDSAOP_GDP` | Claims on Nonfinancial Private Sector (% of GDP) | Percent of GDP | Credit/claims on nonfinancial private sector relative to GDP. |
| `FMB_PCH` | Broad Money Growth | Annual percent change | Growth in broad money. |
| `BX_GDP` | Exports of Goods and Services (% of GDP) | Percent of GDP | Export share of GDP. |
| `BCA_GDP` | External Current Account, Including Grants (% of GDP) | Percent of GDP | Current-account balance including grants. |
| `BM_GDP` | Imports of Goods and Services (% of GDP) | Percent of GDP | Import share of GDP. |
| `BT_GDP` | Trade Balance (% of GDP) | Percent of GDP | Exports minus imports as a share of GDP. |
| `BFD_GDP` | Net Foreign Direct Investment (% of GDP) | Percent of GDP | Net FDI relative to GDP. |
| `BRASS_MI` | Reserves, months of imports | Months of imports | Reserve import cover. |
| `EREER` | Real Effective Exchange Rates (2010=100) | Index, 2010=100 | Real effective exchange-rate index. |
| `ENEER` | Nominal Effective Exchange Rates (2010=100) | Index, 2010=100 | Nominal effective exchange-rate index. |
| `DG_GDP` | External Debt, Official Debt, Debtor Based (% of GDP) | Percent of GDP | Official external debt on a debtor basis. |
| `PCPI_PCH` | Consumer Prices, Average (Annual % Change) | Annual average percent change | Average CPI inflation. |
| `PCPIE_PCH` | Consumer Prices, End of Period (Annual % Change) | Annual percent change | End-period CPI inflation. |
| `TTT` | Terms of Trade (2010=100) | Index, 2010=100 | Terms-of-trade index. |

## Fiscal Rules and Fiscal Councils (`FR_FC`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `FR_ind` | Fiscal Rule Indicator | Index | Indicates whether a country has national and/or supranational fiscal rules. |
| `FC_dummy` | Fiscal Council Indicator | Index | Indicates whether a country has a fiscal council. |

## AI Preparedness Index (`AIPI`)

| Indicator | Label | Unit | Comment |
|---|---|---:|---|
| `AI_PI` | AI Preparedness Index | Index | Overall AI preparedness score. |
| `DI` | Digital Infrastructure | Index | Digital infrastructure pillar of AI preparedness. |
| `IEI` | Innovation and Economic Integration | Index | Innovation/economic-integration pillar of AI preparedness. |
| `HCLMP` | Human Capital and Labor Market Policies | Index | Human-capital and labor-market policy pillar. |
| `RE` | Human Capital and Labor Market Policies | Index | IMF API labels this the same as HCLMP; verify before use. |
