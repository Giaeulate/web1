"""
Wagtail page models for the home app.

This module defines the ``HomePage`` model which serves as the root page
in Wagtail. It inherits from ``wagtail.models.Page`` and includes a
rich text body field to allow content editors to add arbitrary text and
formatting on the home page. Only a single instance of ``HomePage`` is
allowed by setting ``max_count = 1``.
"""

from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel


class HomePage(Page):
    """A simple Wagtail page model for the site home page."""

    max_count: int = 1  # Only one home page should exist.
    body = RichTextField(blank=True, help_text="Content for the home page.")

    content_panels = Page.content_panels + [
        FieldPanel("body"),
    ]

    class Meta:
        verbose_name = "Home page"
        verbose_name_plural = "Home pages"