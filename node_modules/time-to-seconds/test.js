"use strict";

var chai = require("chai");
var expect = chai.expect;

var timeToSeconds = require("./");

describe("timeToSeconds", () => {
  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("asd");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("a:s:d");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("2:s:d");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("!@#$!@#$%#^&$*%$%#&$^@#!%@");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("2:#$%:d");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it('should return error - wrong argument - something else than a number string, in format "number" or "number:number" or "number:number:number", was passed', () => {
    expect(function () {
      timeToSeconds("123a");
    }).to.throw(
      "time-to-seconds: invalid function argument - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it("should return error - wrong argument - too many semicolons", () => {
    expect(function () {
      timeToSeconds("1:2:2:4");
    }).to.throw(
      "time-to-seconds: too many semicolons - please check if argument format is time string; see README for more information on time string formatting."
    );
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("2:2:2");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("02:02:02");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("2:02:02");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("2:2:02");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("02:2:02");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 7322", () => {
    const seconds = timeToSeconds("2:02:2");
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 120", () => {
    const seconds = timeToSeconds("2:");
    expect(seconds).to.be.equal(120);
  });

  it("Should return 120", () => {
    const seconds = timeToSeconds("2:00");
    expect(seconds).to.be.equal(120);
  });

  it("Should return 120", () => {
    const seconds = timeToSeconds("02:0");
    expect(seconds).to.be.equal(120);
  });

  it("Should return 120", () => {
    const seconds = timeToSeconds("02:00");
    expect(seconds).to.be.equal(120);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds("2");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds(":2");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds("0:2");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds(":02");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds("00:02");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds("0:02");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds("000:2");
    expect(seconds).to.be.equal(2);
  });

  it("Should return 2", () => {
    const seconds = timeToSeconds(
      "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002"
    );
    expect(seconds).to.be.equal(7322);
  });

  it("Should return 0", () => {
    const seconds = timeToSeconds("");
    expect(seconds).to.be.equal(0);
  });

  it("Should return 0", () => {
    const seconds = timeToSeconds("0");
    expect(seconds).to.be.equal(0);
  });

  // Decimals
  it("Should return 12", () => {
    const seconds = timeToSeconds("0.2:00");
    expect(seconds).to.be.equal(12);
  });

  it("Should return 12", () => {
    const seconds = timeToSeconds("0.2:");
    expect(seconds).to.be.equal(12);
  });

  it("Should return 720", () => {
    const seconds = timeToSeconds("0.2:00:00");
    expect(seconds).to.be.equal(720);
  });

  it("Should return 720", () => {
    const seconds = timeToSeconds("0.2::");
    expect(seconds).to.be.equal(720);
  });

  it("Should return 732", () => {
    const seconds = timeToSeconds("0.2:0.2:00");
    expect(seconds).to.be.equal(732);
  });

  it("Should return 732", () => {
    const seconds = timeToSeconds("0.2:0.2:");
    expect(seconds).to.be.equal(732);
  });

  it("Should return 0.2", () => {
    const seconds = timeToSeconds("0:0:0.2");
    expect(seconds).to.be.equal(0.2);
  });

  it("Should return 0.2", () => {
    const seconds = timeToSeconds("0::0.2");
    expect(seconds).to.be.equal(0.2);
  });

  it("Should return 0.2", () => {
    const seconds = timeToSeconds(":0:0.2");
    expect(seconds).to.be.equal(0.2);
  });

  it("Should return 0.2", () => {
    const seconds = timeToSeconds("::0.2");
    expect(seconds).to.be.equal(0.2);
  });

  it("Should return 0.2", () => {
    const seconds = timeToSeconds("0.2");
    expect(seconds).to.be.equal(0.2);
  });

  it("Should return 120", () => {
    var num = Math.log10(100);
    const seconds = timeToSeconds(`${num.toString()}:`);
    expect(seconds).to.be.equal(120);
  });

  it("Should return 120", () => {
    const seconds = timeToSeconds(`${Math.log10(100).toString()}:`);
    expect(seconds).to.be.equal(120);
  });
});
