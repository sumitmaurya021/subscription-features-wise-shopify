import React from "react";
import "./widgets.css";

function WidgetPreview({ variant = "reviews", title = "" }) {
  switch (variant) {
    case "rating-badge":
      return (
        <div className="widget-preview widget-preview--rating">
          <div className="widget-preview__panel">
            <div className="widget-preview__topbar" />
            <div className="widget-rating__row">
              <div className="widget-stars widget-stars--dark">★★★★★</div>
              <div className="widget-rating__score">4.8</div>
            </div>
            <div className="widget-line widget-line--lg" />
            <div className="widget-line widget-line--sm" />
            <div className="widget-rating__actions">
              <span className="widget-pill widget-pill--filled" />
              <span className="widget-pill" />
            </div>
          </div>
        </div>
      );

    case "write-review":
      return (
        <div className="widget-preview widget-preview--write">
          <div className="widget-preview__panel widget-preview__panel--narrow">
            <div className="widget-write__title">Write a review</div>
            <div className="widget-write__stars">☆☆☆☆☆</div>
            <div className="widget-line widget-line--xs" />
            <div className="widget-input" />
            <div className="widget-textarea" />
            <div className="widget-submit">Submit review</div>
          </div>
        </div>
      );

    case "carousel":
      return (
        <div className="widget-preview widget-preview--carousel">
          <div className="widget-preview__panel">
            <div className="widget-carousel__header">{title || "Review Carousel"}</div>

            <div className="widget-carousel__card">
              <div className="widget-avatar" />
              <div className="widget-carousel__content">
                <div className="widget-stars widget-stars--dark">★★★★★</div>
                <div className="widget-line widget-line--md" />
                <div className="widget-line widget-line--sm" />
              </div>
            </div>

            <div className="widget-carousel__nav">
              <span className="widget-nav-dot widget-nav-dot--active" />
              <span className="widget-nav-dot" />
              <span className="widget-nav-dot" />
            </div>
          </div>
        </div>
      );

    case "snippet":
      return (
        <div className="widget-preview widget-preview--snippet">
          <div className="widget-preview__panel widget-preview__panel--snippet">
            <div className="widget-snippet__row">
              <div className="widget-stars widget-stars--dark">★★★★★</div>
              <div className="widget-snippet__text">4.9 • 126 reviews</div>
            </div>
            <div className="widget-snippet__chips">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      );

    case "gallery":
      return (
        <div className="widget-preview widget-preview--gallery">
          <div className="widget-preview__panel">
            <div className="widget-gallery__head">
              <div className="widget-line widget-line--sm" />
              <div className="widget-stars widget-stars--dark">★★★★★</div>
            </div>

            <div className="widget-gallery__grid">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="widget-gallery__footer">
              <span className="widget-nav-dot widget-nav-dot--active" />
              <span className="widget-nav-dot" />
            </div>
          </div>
        </div>
      );

    case "review-cards":
      return (
        <div className="widget-preview widget-preview--cards">
          <div className="widget-preview__panel">
            <div className="widget-cards__title">Customer Reviews</div>

            <div className="widget-cards__grid">
              <div className="widget-card-mini">
                <div className="widget-stars widget-stars--dark widget-stars--small">
                  ★★★★★
                </div>
                <div className="widget-line widget-line--card" />
                <div className="widget-line widget-line--card-sm" />
              </div>

              <div className="widget-card-mini">
                <div className="widget-stars widget-stars--dark widget-stars--small">
                  ★★★★★
                </div>
                <div className="widget-line widget-line--card" />
                <div className="widget-line widget-line--card-sm" />
              </div>
            </div>
          </div>
        </div>
      );

    case "badge":
      return (
        <div className="widget-preview widget-preview--badge">
          <div className="widget-preview__panel widget-preview__panel--center">
            <div className="widget-badge-preview">
              <div className="widget-stars widget-stars--dark">★★★★★</div>
              <div className="widget-badge-preview__score">4.9</div>
            </div>
            <div className="widget-badge-preview__label">Trusted by customers</div>
          </div>
        </div>
      );

    case "list":
      return (
        <div className="widget-preview widget-preview--list">
          <div className="widget-preview__panel">
            <div className="widget-list-item">
              <div className="widget-stars widget-stars--dark widget-stars--small">
                ★★★★★
              </div>
              <div className="widget-line widget-line--md" />
            </div>
            <div className="widget-list-item">
              <div className="widget-stars widget-stars--dark widget-stars--small">
                ★★★★★
              </div>
              <div className="widget-line widget-line--md" />
            </div>
            <div className="widget-list-item">
              <div className="widget-stars widget-stars--dark widget-stars--small">
                ★★★★★
              </div>
              <div className="widget-line widget-line--md" />
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="widget-preview widget-preview--reviews">
          <div className="widget-preview__panel">
            <div className="widget-reviews__title">Customer Reviews</div>

            <div className="widget-reviews__grid">
              <div className="widget-reviews__stars">★★★★★</div>

              <div className="widget-bars">
                <span className="widget-bar widget-bar--1" />
                <span className="widget-bar widget-bar--2" />
                <span className="widget-bar widget-bar--3" />
              </div>

              <div className="widget-scorecard">
                <span className="widget-scorecard__fill" />
              </div>
            </div>

            <div className="widget-slider">
              <span />
              <span />
              <span />
            </div>

            <div className="widget-thumbs">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="widget-badges">
              <span className="widget-mini-badge" />
              <span className="widget-mini-badge widget-mini-badge--outline" />
            </div>
          </div>
        </div>
      );
  }
}

function Widgets({ widgets = [] }) {
  return (
    <div className="widgets-page">
      <div className="widgets-header">
        <h1>Widgets</h1>
      </div>

      {widgets.length === 0 ? (
        <div className="widgets-empty">
          <p>No widgets found.</p>
          <p>Make sure your widget liquid files are inside the extension blocks folder.</p>
        </div>
      ) : (
        <div className="widgets-grid">
          {widgets.map((widget) => (
            <div key={widget.id} className="widget-card">
              <WidgetPreview
                variant={widget.previewVariant}
                title={widget.title}
              />

              <div className="widget-card__body">
                <h2 className="widget-card__title">{widget.title}</h2>

                <span
                  className={`widget-badge ${
                    widget.installed
                      ? "widget-badge--success"
                      : "widget-badge--default"
                  }`}
                >
                  <span className="widget-badge__dot" />
                  {widget.installed ? "Installed" : "Not installed"}
                </span>

                <p className="widget-card__description">{widget.description}</p>

                <div
                  className={`widget-card__actions ${
                    widget.installed ? "widget-card__actions--single" : ""
                  }`}
                >
                  <a
                    href={widget.customizeUrl}
                    target="_top"
                    rel="noreferrer"
                    className="widget-btn widget-btn--secondary"
                  >
                    Customize
                  </a>

                  {!widget.installed && widget.installUrl ? (
                    <a
                      href={widget.installUrl}
                      target="_top"
                      rel="noreferrer"
                      className="widget-btn widget-btn--primary"
                    >
                      Install ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Widgets;
