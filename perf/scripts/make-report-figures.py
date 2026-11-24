# Genera las figuras 1.3-1 a 1.3-8 del informe (1.3.3.5) desde perf/results
# Uso: python perf/scripts/make-report-figures.py
import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "perf" / "results"
OUT = ROOT / "docs" / "informe" / "img" / "1-3"
OUT.mkdir(parents=True, exist_ok=True)

# paleta Okabe-Ito (apta daltonismo)
C = {"feed": "#0072B2", "detail": "#E69F00", "create": "#009E73", "matches": "#CC79A7",
     "mine": "#56B4E9", "me": "#7F7F7F", "login": "#000000"}
SLO = "#D55E00"
INK = "#222222"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": "#888888",
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.grid": True, "grid.color": "#E3E3E3", "grid.linewidth": 0.6,
    "axes.spines.top": False, "axes.spines.right": False, "figure.facecolor": "white",
    "axes.facecolor": "white", "legend.frameon": False,
})


def jload(name):
    return json.loads((RES / name).read_text(encoding="utf-8"))


def save(fig, name):
    fig.savefig(OUT / name, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("ok", name)


def slo_line(ax, label=True, y=500):
    ax.axhline(y, color=SLO, ls="--", lw=1.2)
    if label:
        ax.text(0.01, y, "SLO-1: 500 ms", color=SLO, transform=ax.get_yaxis_transform(),
                va="bottom", ha="left", fontsize=8)


def p95(m, key):
    v = m.get(key)
    return v["values"]["p(95)"] if v else None


# Figura 1: carga, p95 por endpoint y paso de VUs
def fig1():
    m = jload("load.summary.json")["metrics"]
    steps = ["100", "200", "500"]
    fig, ax = plt.subplots(figsize=(6.5, 4))
    for ep in ["feed", "detail", "create", "matches", "mine", "me", "login"]:
        ys = [p95(m, f"http_req_duration{{name:{ep},step:{s}}}") for s in steps]
        ax.plot(steps, ys, marker="o", color=C[ep], lw=1.8, ms=5,
                ls="--" if ep == "login" else "-",
                label=ep + (" (informativo)" if ep == "login" else ""))
    ax.set_yscale("log")
    slo_line(ax)
    ax.set_xlabel("Usuarios virtuales concurrentes (VUs)")
    ax.set_ylabel("p95 de latencia (ms, escala log)")
    ax.set_title("Carga: p95 por endpoint según el paso de VUs", loc="left", fontweight="bold")
    ax.legend(ncol=2, fontsize=8, loc="lower right")
    save(fig, "fig-1-3-1-carga-p95.png")


# Figura 2: punto de quiebre
def fig2():
    m = jload("breakpoint.summary.json")["metrics"]
    rates = [2 + 0.5 * i for i in range(8)]
    fig, (a, b) = plt.subplots(1, 2, figsize=(9, 3.8))
    for ep in ["feed", "detail", "create"]:
        ys = [p95(m, f"http_req_duration{{name:{ep},step:s{i + 1}}}") for i in range(8)]
        a.plot(rates, ys, marker="o", color=C[ep], lw=1.8, ms=5, label=ep)
    slo_line(a)
    a.set_xlabel("Tasa de arribo objetivo (it/s)")
    a.set_ylabel("p95 de latencia (ms)")
    a.set_title("p95 por escalón", loc="left", fontweight="bold")
    a.legend(fontsize=8, loc="upper left", bbox_to_anchor=(0, 0.9))
    rps = [m[f"http_reqs{{step:s{i + 1}}}"]["values"]["count"] / 46 for i in range(8)]
    b.plot(rates, rps, marker="s", color="#0072B2", lw=1.8, ms=5)
    b.axvline(4.5, color=SLO, ls="--", lw=1.2)
    b.text(4.45, min(rps), "capacidad: 4,5 it/s", color=SLO, ha="right", fontsize=8)
    b.set_xlabel("Tasa de arribo objetivo (it/s)")
    b.set_ylabel("Throughput (req/s)")
    b.set_title("Throughput por escalón", loc="left", fontweight="bold")
    fig.suptitle("Punto de quiebre: curva de saturación (mezcla 80/20)", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-2-punto-de-quiebre.png")


# Figura 3: estres
def fig3():
    m = jload("stress.summary.json")["metrics"]
    lv = ["base", "x1.5", "x2", "x3", "recovery_drain", "recovery_steady"]
    lab = ["base\n4,5", "x1,5\n6,75", "x2\n9", "x3\n13,5", "recup.\n(vaciado)", "recup.\n(estable)"]
    fig, (a, b) = plt.subplots(1, 2, figsize=(9.5, 3.8))
    w = 0.26
    for k, ep in enumerate(["feed", "detail", "create"]):
        ys = [p95(m, f"http_req_duration{{name:{ep},step:{s}}}") for s in lv]
        a.bar([i + (k - 1) * w for i in range(6)], ys, w, color=C[ep], label=ep)
    a.set_yscale("log")
    slo_line(a)
    a.set_xticks(range(6))
    a.set_xticklabels(lab, fontsize=8)
    a.set_ylabel("p95 de latencia (ms, escala log)")
    a.set_xlabel("Nivel (tasa objetivo, it/s)")
    a.set_title("p95 por nivel", loc="left", fontweight="bold")
    a.legend(fontsize=8, loc="upper left", bbox_to_anchor=(0, 0.92))
    err = [m[f"http_req_failed{{step:{s}}}"]["values"]["rate"] * 100 for s in lv]
    bars = b.bar(range(6), err, 0.6, color="#0072B2")
    for r, e in zip(bars, err):
        b.text(r.get_x() + r.get_width() / 2, e, f"{e:.2f}".replace(".", ",") + " %", ha="center", va="bottom", fontsize=8)
    b.axhline(5, color=SLO, ls="--", lw=1.2)
    b.text(0.01, 5, "criterio: 5 %", color=SLO, transform=b.get_yaxis_transform(), va="bottom", fontsize=8)
    b.set_xticks(range(6))
    b.set_xticklabels(lab, fontsize=8)
    b.set_ylabel("Requests fallidos (%)")
    b.set_xlabel("Nivel (tasa objetivo, it/s)")
    b.set_title("Error por nivel", loc="left", fontweight="bold")
    fig.suptitle("Estrés: latencia y error por nivel de carga", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-3-estres.png")


# Figura 4: picos
def fig4():
    fig, axs = plt.subplots(1, 2, figsize=(9.5, 3.8), sharey=True)
    for ax, name, ttl in [(axs[0], "spike.windows.json", "Base 10 it/s (pico objetivo 100 it/s)"),
                          (axs[1], "spike.base2.windows.json", "Base 2 it/s (pico objetivo 20 it/s)")]:
        w = jload(name)
        t = [(x["start_s"] + x["end_s"]) / 2 for x in w]
        ax.axvspan(20, 80, color="#F2D7A6", alpha=0.5, lw=0)
        ax.plot(t, [x["p95_feed"] for x in w], color=C["feed"], lw=1.8, marker="o", ms=3, label="feed")
        ax.plot(t, [x["p95_detail"] for x in w], color=C["detail"], lw=1.8, marker="o", ms=3, label="detail")
        ax.set_yscale("log")
        slo_line(ax)
        ax.text(50, 12, "tramo del pico", ha="center", fontsize=8)
        ax.set_xlabel("Tiempo desde el inicio (s)")
        ax.set_title(ttl, loc="left", fontweight="bold", fontsize=9)
    axs[0].set_ylabel("p95 por ventana de 5 s (ms, escala log)")
    axs[0].legend(fontsize=8, loc="upper right")
    fig.suptitle("Picos: p95 en el tiempo (solo visitante)", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-4-picos.png")


# Figura 5: volumen
def fig5():
    d = jload("volume.compare.json")
    eps = d["endpoints"]
    fig, (a, b) = plt.subplots(1, 2, figsize=(9.5, 3.8))
    w = 0.38
    for ax, key, yl, ttl in [(a, "p95Ms", "p95 de latencia (ms)", "p95 por endpoint"),
                             (b, "bodyBytes", "Tamaño de respuesta promedio (bytes, escala log)", "Tamaño de respuesta")]:
        for k, (lab, col) in enumerate([("1x", "#56B4E9"), ("10x", "#0072B2")]):
            ys = d["series"][key][lab]
            bars = ax.bar([i + (k - 0.5) * w for i in range(len(eps))], ys, w, color=col, label=lab + (" (1000 reportes)" if k == 0 else " (10000 reportes)"))
            for r, y in zip(bars, ys):
                ax.text(r.get_x() + r.get_width() / 2, y, f"{y:,.0f}".replace(",", "."), ha="center", va="bottom", fontsize=7)
        ax.set_xticks(range(len(eps)))
        ax.set_xticklabels(eps)
        ax.set_ylabel(yl)
        ax.set_title(ttl, loc="left", fontweight="bold")
    slo_line(a)
    b.set_yscale("log")
    a.set_ylim(0, 780)
    b.set_ylim(1, 3e7)
    a.legend(fontsize=8, loc="upper right")
    fig.suptitle("Volumen: base con 1x frente a 10x de datos (3 it/s)", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-5-volumen.png")


# Figura 6: resistencia
def fig6():
    rows = list(csv.DictReader((RES / "soak.resources.csv").open(encoding="utf-8")))

    def col(c):
        t, v = [], []
        for r in rows:
            try:
                x = float(r[c])
            except ValueError:
                continue
            if x == x:
                t.append(float(r["elapsed_s"]) / 60)
                v.append(x)
        return t, v

    meta = jload("soak.meta.json")
    fig, axs = plt.subplots(2, 2, figsize=(9.5, 6.4))
    for ax, c, yl, ttl in [(axs[0][0], "backend_rss_mb", "RSS (MB)", "Memoria del backend"),
                           (axs[0][1], "backend_cpu_pct_of_core", "% de un núcleo", "CPU del backend"),
                           (axs[1][0], "pg_connections", "Conexiones", "Conexiones a PostgreSQL")]:
        t, v = col(c)
        ax.plot(t, v, color="#0072B2", lw=1.6)
        ax.set_xlabel("Tiempo del muestreo (min)")
        ax.set_ylabel(yl)
        ax.set_title(ttl, loc="left", fontweight="bold")
    axs[1][0].set_ylim(0, 12)
    axs[0][0].set_ylim(0, 300)
    ax = axs[1][1]
    eps = [r for r in meta["rows"] if r["name"] != "login"]
    w = 0.26
    for k, (lab, col_) in enumerate([("t1", "#56B4E9"), ("t2", "#0072B2"), ("t3", "#003A5C")]):
        ax.bar([i + (k - 1) * w for i in range(len(eps))], [r["p95"][k] for r in eps], w, color=col_, label=lab)
    ax.set_xticks(range(len(eps)))
    ax.set_xticklabels([r["name"] for r in eps], fontsize=8)
    slo_line(ax)
    ax.set_ylim(0, 700)
    ax.set_ylabel("p95 de latencia (ms)")
    ax.set_title("p95 por tercio de la fase estable", loc="left", fontweight="bold")
    ax.legend(fontsize=8, ncol=3, loc="upper right")
    fig.suptitle("Resistencia: 35 min (31 min estables) a 3,15 it/s", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-6-resistencia.png")


# Figura 7: escalabilidad
def fig7():
    runs = {
        1: [("principal", "scalability.1cpu.steps.json", "#0072B2"),
            ("repetición 1", "rep1/scalability.1cpu.steps.json", "#E69F00"),
            ("repetición 1 gruesa", "rep1/scalability.1cpu.coarse.steps.json", "#009E73"),
            ("repetición 2 (censurada)", "rep2-n1-censurado/scalability.1cpu.steps.json", "#CC79A7")],
        2: [("principal", "scalability.2cpu.steps.json", "#0072B2"),
            ("repetición 1", "rep1/scalability.2cpu.steps.json", "#E69F00")],
        4: [("principal", "scalability.4cpu.steps.json", "#0072B2"),
            ("repetición 1", "rep1/scalability.4cpu.steps.json", "#E69F00")],
    }
    fig, axs = plt.subplots(1, 3, figsize=(11, 4), sharey=True)
    for ax, n in zip(axs, [1, 2, 4]):
        for lab, f, col in runs[n]:
            rows = jload(f)["rows"]
            x = [r["rate"] for r in rows]
            y = [r["maxP95"] for r in rows]
            ax.plot(x, y, color=col, lw=1.4, label=lab)
            for xi, yi, r in zip(x, y, rows):
                ax.plot(xi, yi, marker="o" if r["ok"] else "x", color=col, ms=5, mfc=col if r["ok"] else "none")
        ax.set_yscale("log")
        slo_line(ax, label=(n == 1))
        ax.set_xlabel("Tasa de arribo objetivo (it/s)")
        ax.set_title(f"{n} instancia" + ("s" if n > 1 else ""), loc="left", fontweight="bold")
        ax.legend(fontsize=7, loc="upper left" if n == 1 else "lower right")
    axs[0].set_ylabel("p95 máximo feed/detail (ms, escala log)")
    fig.suptitle("Escalabilidad: p95 por escalón en cada corrida (círculo = cumple, x = no cumple)", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-7-escalabilidad.png")


# Figura 8: Lighthouse
def fig8():
    d = jload("lighthouse/summary.json")
    routes = ["/login", "/reports", "/reports/:id"]
    fig, axs = plt.subplots(1, 2, figsize=(9.5, 3.8), sharey=True)
    for ax, key, thr, ttl in [(axs[0], "performance", 80, "Performance"), (axs[1], "accessibility", 90, "Accesibilidad")]:
        for k, (ff, col) in enumerate([("mobile", "#0072B2"), ("desktop", "#E69F00")]):
            ys = []
            for r in routes:
                v = [x[key] for x in d if x["formFactor"] == ff and x["route"] == r]
                ys.append(round(v[0] * 100) if v else 0)
            bars = ax.bar([i + (k - 0.5) * 0.38 for i in range(3)], ys, 0.38, color=col, label=ff)
            for b_, y in zip(bars, ys):
                ax.text(b_.get_x() + b_.get_width() / 2, y, str(y), ha="center", va="bottom", fontsize=8)
        ax.axhline(thr, color=SLO, ls="--", lw=1.2)
        ax.text(0.01, thr, f"umbral propuesto: {thr}", color=SLO, transform=ax.get_yaxis_transform(), va="bottom", fontsize=8)
        ax.set_xticks(range(3))
        ax.set_xticklabels(routes)
        ax.set_ylim(0, 112)
        ax.set_title(ttl, loc="left", fontweight="bold")
    axs[0].set_ylabel("Puntaje (0-100, mediana de 3 corridas)")
    axs[1].legend(fontsize=8, loc="lower right")
    fig.suptitle("Lighthouse: puntajes por ruta y factor de forma", x=0.01, ha="left", fontweight="bold")
    fig.tight_layout()
    save(fig, "fig-1-3-8-lighthouse.png")


if __name__ == "__main__":
    for f in (fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8):
        f()
