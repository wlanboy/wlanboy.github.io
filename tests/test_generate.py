from textwrap import dedent

import pytest

from generate import MAX_DESCRIPTION_LENGTH, extract_title_and_paragraph


def parse(markdown: str):
    return extract_title_and_paragraph(dedent(markdown).strip("\n"))


def test_simple_paragraph():
    title, desc = parse("""
        # kafka-demo

        Spring Boot producer and consumer for **Kafka** with `docker compose`.
        Second line of the same paragraph.

        Second paragraph is ignored.
    """)
    assert title == "kafka-demo"
    assert desc == (
        "Spring Boot producer and consumer for Kafka with docker compose. "
        "Second line of the same paragraph."
    )


def test_badge_line_is_skipped():
    _, desc = parse("""
        # istio-tools

        [![Build](https://github.com/wlanboy/istio-tools/actions/workflows/build.yml/badge.svg)](https://github.com/wlanboy/istio-tools/actions)
        ![License](https://img.shields.io/badge/license-MIT-blue.svg)

        Helper scripts for an [Istio](https://istio.io) mesh on k3s.
    """)
    assert desc == "Helper scripts for an Istio mesh on k3s."


def test_list_after_colon_is_appended():
    _, desc = parse("""
        # homelab

        This repository contains:

        - Helm charts for **nginx**
        - Ansible roles,
          with continuation line
        * [Grafana](https://grafana.com) dashboards

        ## Usage

        Not part of the description.
    """)
    assert desc == (
        "This repository contains: Helm charts for nginx; "
        "Ansible roles, with continuation line; Grafana dashboards."
    )


def test_list_directly_after_colon():
    _, desc = parse("""
        # tools
        Features:
        1. fast
        2. small
        Trailing text ends the list.
    """)
    assert desc == "Features: fast; small."


def test_colon_without_list_becomes_period():
    _, desc = parse("""
        # demo

        Run it like this:

        ```bash
        uv run main.py
        ```
    """)
    assert desc == "Run it like this."


def test_code_block_before_text():
    _, desc = parse("""
        # cli

        ```
        # not a heading
        some code
        ```

        Small command line tool.
    """)
    assert desc == "Small command line tool."


def test_text_under_first_subheading():
    _, desc = parse("""
        # project

        ## About

        > Quoted description
        > over two lines.
    """)
    assert desc == "Quoted description over two lines."


def test_stops_at_second_subheading():
    _, desc = parse("""
        # project

        ## Install

        ## Usage

        Text under the second subheading.
    """)
    assert desc is None


def test_table_is_skipped_and_ends_paragraph():
    _, desc = parse("""
        # matrix

        | Name | Port |
        |------|------|
        | web  | 8080 |

        Text after the table.
        | a | b |
        Not included.
    """)
    assert desc == "Text after the table."


def test_html_is_stripped():
    _, desc = parse("""
        # site

        <p align="center"><img src="logo.png"></p>

        Static <b>homepage</b> on GitHub Pages.
    """)
    assert desc == "Static homepage on GitHub Pages."


def test_long_paragraph_is_truncated():
    _, desc = parse("# long\n\n" + "word " * 200)
    assert desc is not None
    assert desc.endswith("…")
    assert len(desc) <= MAX_DESCRIPTION_LENGTH + 1


@pytest.mark.parametrize("markdown", ["", "no heading at all", "#\n\ntext"])
def test_no_title(markdown):
    assert extract_title_and_paragraph(markdown) == (None, None)


def test_title_markdown_is_stripped():
    title, desc = parse("# [**my-repo**](https://example.org)")
    assert title == "my-repo"
    assert desc is None
